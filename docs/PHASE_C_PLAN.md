# Phase C — Execution Plan: Move the app onto the multi-tenant schema

**Status:** C1 complete. C2 complete + tested. C3–C6 pending.
**Owner:** Arnaldo Castillo Toro
**Created:** 2026-08-22

Phase C points the SplitPay **application code** at the new multi-tenant schema
(`organizations`, `locations`, `users`, `memberships`) instead of the legacy
`venues` / `venue_users`. The database was already **expanded + backfilled**
(migrations `drizzle/0002_mt_expand.sql`, `drizzle/0003_mt_backfill.sql`). The
old `venue_id` columns and the `venues` / `venue_users` tables still exist and
stay until a later **contract** migration. We execute one stage at a time with
testing between each.

---

## 0. Ground state

**Database (expand + backfill applied):**
- New tables **populated**: `organizations`, `locations`, `users`, `memberships`
  (+ `membership_role` enum).
- Every downstream table has **new nullable tenant columns alongside the old
  `venue_id`**: `location_id` / `organization_id` on `tables`, `checks`,
  `integrations`, `payouts`; `organization_id` on `check_items`, `claims`,
  `payments`, `refunds`. `refunds` also got `initiated_by_user_id_new`
  (→ `users`).
- Backfill invariants we rely on: **`locations.id == venues.id`**;
  `organization_id = md5(venue_id || ':org')::uuid`; `onboarding_complete`
  copied onto **both** org and location; `stripe_account_id` copied onto
  location; users deduped by lowercased email; memberships mapped
  `owner → org_admin` (location NULL), `manager → location_manager`,
  `staff → server`.

**Code:** still on the old path. Tenant scoping is **app-level
`WHERE venue_id = …`** over a single Drizzle connection (`DATABASE_URL`). Tenant
identity resolves `supabase user → venue_users → venue`. Admin gating is the
`ADMIN_EMAIL` env hack via `requireAdmin()`.

**Explicitly OUT of Phase C scope** (confirmed):
- **RLS** — not implemented today and not added here. Phase C keeps app-level
  scoping, just re-points it venue → location/org. Real RLS is a later phase.
- **`admin_audit_log`** — table doesn't exist in any migration; not created here.
- **Auth transport** — login/callback is currently magic-link/OTP (an
  anti-pattern per the architecture doc, which wants password + Google for
  restaurant users, magic-link + TOTP for admins). Phase C swaps *identity
  resolution*, not the transport.
- **Dropping `venues` / `venue_users`** and the old columns — the later contract
  migration.

---

## 1. Approved decisions

1. **Multi-membership → active tenant:** resolve to the single active
   membership; if a user has >1, pick deterministically (org_admin first, then
   most recent). **No location switcher** in v1.
2. **`org_admin` (membership `location_id = NULL`) → location:** resolve to the
   org's sole location; **error if the org has multiple** locations.
3. **Field ownership split:**
   - **Org:** `legalName`, `businessType`, `taxId`, `country`, `billingEmail`.
   - **Location:** `email`, `phone`, `address`, `city`, `state`, `zip`,
     `timezone`, `website`, `logoUrl`, `brandColor`, `tipSuggestions`,
     `paymentModel`, `stripe*`.
   - Keep **`org.name == location.name` in sync** for v1.
   - Onboarding sets **`country` on the org** and **derives `paymentModel` onto
     the location** via `getDefaultPaymentModel(country)`.
4. **`refunds` initiator:** write the new column `initiatedByUserIdNew`
   (`initiated_by_user_id_new` → `users`). The contract phase renames it to
   `initiated_by_user_id` after dropping the legacy `→ venue_users` column.
5. **Manual payouts** attach to **`organization_id`** (billing level);
   `location_id` is kept populated for reference.
6. **Admin gate** stays in `requireAdmin()`, backed by `users.is_platform_admin`
   (replacing the `ADMIN_EMAIL` hack); it moves to middleware in the RLS phase.

---

## 2. Stages

### Stage C1 — `schema.ts` as source of truth ✅ DONE
**Files:** `lib/db/schema.ts` (only).

**Changes (additive; nothing deleted):**
- Add `membershipRole` pgEnum.
- Define `organizations`, `locations`, `users`, `memberships` to match the
  `0002_mt_expand` DDL exactly (columns, types, defaults, uniques, FKs, indexes).
- Add the new nullable tenant columns to the existing tables **while keeping
  every `venueId` column** (incl. `refunds.initiatedByUserIdNew`).
- Add relations for the new tables; extend downstream relations
  (`checks.location` / `.organization`, etc.). Keep `venues` / `venueUsers`
  intact (labeled `LEGACY`).

**Verification done:** `tsc` clean; `db:generate` produced DDL identical to the
already-applied migration (only `CREATE TABLE` / `ADD COLUMN` / FK / index —
**no `DROP`, no `ALTER COLUMN`, no legacy-table changes**), proving `schema.ts`
matches the live DB. (The generated file is a duplicate of applied DDL and was
discarded — see the gotcha below.) A live DB round-trip could not be run from
the dev sandbox (no network path to the Supabase host); Drizzle did build
correct SQL for the new tables + relations.

**⚠️ drizzle-meta gotcha:** the `drizzle/meta` snapshots were **never maintained**
for the hand-written migrations `0001`–`0003` (only `0000_snapshot.json`
exists). So `db:generate` diffs `schema.ts` against the old venue-only snapshot
and re-emits the entire multi-tenant DDL as a phantom migration. **Migrations
here are hand-written — discard generated files; don't rely on an empty
`generate` diff as a health check.**

---

### Stage C2 — Auth / tenant resolution ✅ DONE + TESTED
A bug here locks everyone out or leaks tenants.

**Design:** add `getAuthContext()` to `lib/dashboard-auth.ts` returning
`{ user, dbUser, memberships, activeMembership, organization, location,
isPlatformAdmin }` (supabase user → `users` by `supabase_user_id`, fallback
email → `memberships` → org/location, applying decisions #1/#2). **Keep the old
`getUserVenue()` in place** so C3's not-yet-migrated routes keep working — both
read the same backfilled data, so they stay consistent through the gap.

**Files:**
- `lib/dashboard-auth.ts` — add `getAuthContext()` (keep `getUserVenue()` temporarily).
- `lib/admin.ts` — `requireAdmin()` checks `users.is_platform_admin` instead of `ADMIN_EMAIL`.
- `app/dashboard/layout.tsx`, `app/onboard/layout.tsx` — onboarding gate via org/location.
- `app/api/auth/link-user/route.ts` — set `supabase_user_id` on the `users` row (by lowercased email); return `onboardingComplete` from org/location.
- `app/api/auth/login/route.ts` — validate email against `users`; `is_platform_admin` bypass.
- `app/api/admin/payouts/route.ts` `isAdmin()` — `is_platform_admin`.
- *(optional per #6)* `middleware.ts`.

**Risks:** lockouts (email case, null `supabase_user_id`, 0 or >1 memberships),
wrong-tenant resolution. **Your admin user must be promoted in the DB first**
(`UPDATE users SET is_platform_admin = true …`) or `/admin` is lost.

**Test:** admin reaches `/admin`, non-admin blocked; owner → dashboard;
un-onboarded → `/onboard`, onboarded can't re-enter; unregistered email rejected
at login; first-login links `supabase_user_id`; resolved org/location ids match
the backfill.

**Tested (verified):** magic-link login succeeds and lands on localhost;
platform admin reaches `/admin`; un-onboarded → `/onboard`; onboarded →
`/dashboard` and `/onboard` bounces back (verified by temporarily flipping an
org's `onboarding_complete`, then reverting); `supabase_user_id` dual-write to
`users` + `venue_users` confirmed in the DB; org/location resolution matches the
backfill. Code-verified (not run live): non-admin redirected off `/admin`
(`requireAdmin` → `/dashboard`) and unregistered-email 403 — both low-risk,
backed by reviewed code; the legacy `getUserVenue()` path still resolves a venue
for a migrated user (DB-confirmed), so not-yet-migrated C3 routes keep working.

**PKCE callback fix (surfaced during C2 testing):** the old client-component
`app/auth/callback/page.tsx` ran `exchangeCodeForSession()` in a `useEffect`,
which React Strict Mode double-fired — the first call consumed the one-time PKCE
verifier and the second threw "PKCE code verifier not found in storage".
Replaced with a server-side Route Handler `app/auth/callback/route.ts` (runs
once, sets session cookies server-side) that inlines the former
`/api/auth/link-user` behavior (the `supabase_user_id` dual-write + the
`getAuthContext()` onboarding redirect). Transport is unchanged — still
magic-link, per the "auth transport is out of scope" note above.
`/api/auth/link-user` is now unused and can be deleted in a later cleanup.

---

### Stage C3 — Dashboard + onboard API routes
Each: swap inline `getUserVenue` → `getAuthContext`, scope by
`location_id` / `organization_id`, stamp both tenant columns on inserts.

**Files:**
- `app/api/dashboard/venue/route.ts` — GET returns org+location; PUT writes each
  field to the right entity (#3); POST create-path creates
  `organization → location → users row/link → membership → integration` in one txn.
- `app/api/dashboard/tables/route.ts` — scope by `locationId`; stamp org+location.
- `app/api/dashboard/tables/[tableId]/qr/route.ts` — **add ownership check**
  (currently none — any `tableId` can be regenerated by anyone).
- `app/api/dashboard/checks/route.ts` — scope by `locationId`; stamp org/location
  on checks, `organizationId` on check_items.
- `app/api/dashboard/transactions/route.ts` — filter `payments` by
  `organizationId` directly (drop the fetch-all-checks hack).
- `app/api/dashboard/refunds/route.ts` — verify payment by `organizationId`;
  write `initiatedByUserIdNew = dbUser.id` (#4); `paymentModel` from location.
- `app/api/dashboard/stripe/onboard/route.ts`, `stripe/login-link/route.ts` —
  Stripe fields on location.
- `app/api/onboard/route.ts` — split wizard payload: org fields → `organizations`,
  location fields → `locations`; set `onboardingComplete` on both (#3).

**Risks:** field-ownership split, multi-insert transactions, the new QR
ownership check. Guest pay/checkout still read `check.venue` here (untouched
until C4, consistent via duplicated data).

**Test:** full merchant loop — edit settings, add table, generate QR, create a
check (shows on staff floor), view transactions, issue a refund; confirm a
second org can't see the first's data.

**Deploy:** ship **C2 + C3 together** as the "dashboard" release, then remove the
dead `getUserVenue()`.

---

### Stage C4 — Guest pay + checkout + webhooks (money path)
**Files:**
- `app/pay/[tableId]/page.tsx` — load check with the `location` relation.
- `app/api/checkout/route.ts` — load check with `location`;
  `createPaymentAdapter(check.location)`; stamp `organizationId` on
  claims/payments; pass location name.
- `app/api/webhooks/stripe/route.ts` — update check via location/org; receipt
  uses `check.location.name`; **`account.updated` / `payout.paid` match on
  `locations.stripeAccountId`**; insert `payouts` with `location_id` /
  `organization_id`.
- `lib/payments/factory.ts` — `VenuePaymentConfig` → `LocationPaymentConfig`
  (same three fields).
- `lib/payments/stripe-connect-adapter.ts`, `aggregator-adapter.ts`,
  `lib/email.ts` — `venueName` → location name (cosmetic).

**Risks:** funds path. Riskiest piece is Stripe-account matching in the webhook —
verify every connected `location.stripeAccountId` was backfilled.

**Test:** end-to-end on Stripe **test mode** (aggregator + connect) — guest pays,
webhook flips the check, receipt sends, refund reflects, simulated `payout.paid`
inserts a payout row. Watch Sentry.

**Deploy:** its own money-path release.

---

### Stage C5 — Admin pages
**Files:**
- `app/admin/page.tsx` — counts over organizations/locations; volume via new columns.
- `app/admin/venues/page.tsx` — locations/orgs; table counts by `location_id`.
  *(Consider renaming the route to `/admin/locations`.)*
- `app/admin/transactions/page.tsx` — join `payments → checks → locations` (or
  `payments.organization_id`); venue filter → location/org filter.
- `app/admin/payouts/page.tsx` + `RecordPayoutForm.tsx` — aggregator locations;
  owed/paid by org/location (#5); prop `venueId` → `organizationId` / `locationId`.
  Replace the raw `sql\`checks.venue_id = ANY(...)\`` fragment.
- `app/api/admin/payouts/route.ts` — insert payout with `organization_id`
  (+ `location_id`) per #5.

**Risks:** mostly read-only; the one write is the payout insert.

**Test:** overview numbers, transactions list + filter, record a payout.

---

### Stage C6 — POS/payment libs + scripts
**Files:**
- `lib/pos/factory.ts` — `createPOSAdapter(venueId)` → `(locationId)`; lookup by
  `location_id`. *(Not called at runtime yet — safe rename.)*
- `lib/pos/adapter.ts`, `lib/pos/manual-adapter.ts` — `venueId` → `locationId`.
- `scripts/onboard.ts`, `scripts/onboard-simple.ts` — create
  `organization → location → users → membership → integration`.
- `scripts/seed.ts` — org+location+table+check+items with tenant ids.
- `scripts/check-payments.ts`, `check-tables.ts`, `complete-payment.ts`,
  `get-payment-url.ts` — update venue refs (dev-only).

**Risks:** dev-only, but onboarding scripts are the real customer-creation path.

**Test:** run `db:seed` + `onboard` on a scratch DB, then take a freshly
onboarded restaurant through login → table → check → guest pay.

---

## 3. Execution order, deploy units, rollback

**Order:** C1 → C2 → C3 → C4 → C5 → C6.

**Deploy units:** `[C1]` · `[C2 + C3]` (dashboard) · `[C4]` (money path, watch
Sentry) · `[C5]` (admin) · `[C6]` (scripts/libs). Test-and-commit after every
stage.

**Rollback:** because the migration only *expanded* (old tables and `venue_id`
columns remain populated), every stage is revertable by **git alone with zero DB
change**. The DB stays valid for both code paths until the contract migration —
which is out of Phase C scope.
