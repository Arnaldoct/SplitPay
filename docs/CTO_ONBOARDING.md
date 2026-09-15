# CTO Onboarding — SplitPay

**Audience:** incoming co-founder / CTO (senior engineer).
**Goal:** get you productive fast and pointed at the one decision that needs you next.
**Last updated:** 2026-09-14 · **Prod HEAD:** `origin/main` @ `b03e668`

This is the fast-start map. The canonical design doc is **`docs/ARCHITECTURE.md`** (source
of truth) and the active migration plan is **`docs/PHASE_C_PLAN.md`**. Where this doc and
those disagree, those win — tell me and I'll fix this one.

---

## 1. What SplitPay is

SplitPay is a pay-at-table product for restaurants, modeled on Sunday (sundayapp.com): a
guest scans a QR at their table, sees the itemized check, picks how to split it, and pays by
Apple Pay / Google Pay / card via Stripe — no app install, no login. The restaurant enters
and manages checks from a merchant dashboard (a "ManualAdapter" stands in for real POS
integrations in v1), and payments reconcile back automatically. We take a small commission on
every transaction via Stripe Connect.

---

## 2. Stack & where everything lives

| Concern | Choice | In the repo |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript, Tailwind | `app/`, `next.config.ts` |
| Hosting | Vercel — auto-deploys from GitHub `main`, preview deploys on PRs | `vercel.json` |
| DB | Postgres on Supabase | — |
| ORM | Drizzle | `lib/db/schema.ts` (schema = source of truth), `lib/db/index.ts` (client), `drizzle.config.ts`, `drizzle/` (migrations) |
| Auth | Supabase Auth (today: magic-link/OTP — see §7 gotcha and §5 Phase F) | `app/api/auth/login/route.ts`, `app/auth/callback/route.ts`, `lib/supabase/` |
| Tenant resolution | app-level, in code | `lib/dashboard-auth.ts` (`getAuthContext`, `requireTenantContext`) |
| Admin gate | `users.is_platform_admin` | `lib/admin.ts`, `middleware.ts` |
| Payments | Stripe + Stripe Connect (Express); **Stripe Checkout hosted, never Elements** (PCI SAQ A) | `lib/payments/` (`factory.ts`, `stripe-connect-adapter.ts`, `aggregator-adapter.ts`), `app/api/checkout/route.ts`, `app/api/webhooks/stripe/route.ts` |
| POS | `POSAdapter` interface; `ManualAdapter` default | `lib/pos/` (`factory.ts`, `adapter.ts`, `manual-adapter.ts`) |
| Email | Resend (receipts) | `lib/email.ts` |
| Merchant dashboard | tables, QR, checks, transactions, refunds, Stripe onboarding | `app/dashboard/*`, `app/api/dashboard/*` |
| Guest pay | signed-token QR → check → Checkout | `app/pay/[tableId]/`, `app/api/checkout/route.ts` |
| Admin | overview, transactions, venues, payouts | `app/admin/*`, `app/api/admin/*` |
| Dev scripts | seed, onboard, spot-check helpers | `scripts/*` |
| Error tracking | Sentry — **mandatory in prod before real payments** (not wired yet) | — |

Full env var table is in `ARCHITECTURE.md` §"Environment variables"; the local template is
`.env.example`. Money is always **integer cents**; times **UTC in DB**, localized in UI.

---

## 3. Architecture in one screen

Read `docs/ARCHITECTURE.md` for the whole thing. The load-bearing ideas:

**Multi-tenant hierarchy** (`lib/db/schema.ts`):
```
Organization (business / brand — billing + legal/tax live here)
  ├── Location (one physical restaurant — address, timezone, Stripe Connect, POS live here)
  │     ├── Table (one QR code)
  │     │     └── Check (open bill: items, payments, status)
  │     └── Integration (one per location — ManualAdapter by default)
  └── Membership (User ↔ Organization + Role, optional Location scope)
```
- Roles: `org_admin`, `location_manager`, `server`, `accountant`. `membership.location_id = NULL`
  means org-wide (`org_admin`, `accountant`); set means scoped to that one location.
- **Even a single-location restaurant gets both an Organization and a Location row.** Never
  collapse them. Stripe Connect attaches at **Location**; our commission billing at
  **Organization**.
- Field ownership (Phase C Decision #3): **org** owns `legalName/businessType/taxId/country/
  billingEmail`; **location** owns `email/phone/address/city/state/zip/timezone/website/
  logoUrl/brandColor/tipSuggestions/paymentModel/stripe*`. `org.name == location.name` is kept
  in sync for v1.

**Platform-admin layer:** SplitPay staff are **not** an Organization. A `users.is_platform_admin`
flag gates everything under `/admin/*`. Today that gate is `requirePlatformAdmin()` in
`lib/admin.ts`; per plan it moves to `middleware.ts` in the RLS phase.

**Guests never log in:** no accounts, no rows in `users`. A guest exists only as the payer
email on a Payment row. QR scan → pay → leave.

---

## 4. Exactly where we are

**Deployed:** `origin/main` @ **`b03e668`**, pushed and live on Vercel. The runtime env was
switched to the Supabase **transaction pooler** and verified.

Phase C re-points the **app code** from the legacy `venues`/`venue_users` tables onto the new
`organizations`/`locations`/`users`/`memberships` schema. The DB was already **expanded +
backfilled** (migrations `0002_mt_expand.sql`, `0003_mt_backfill.sql`); the old `venue_id`
columns and `venues`/`venue_users` tables **still exist and stay** until a later *contract*
migration. This means every stage is revertable by **git alone, zero DB change** — the DB is
valid for both code paths during the migration.

**Done and deployed — C1 → C3:**

| Stage | Commit | What it did |
|---|---|---|
| infra | `eaf3059` | App runtime → transaction pooler (`:6543`, `prepare:false`); migrations → `DIRECT_URL` (`:5432`) |
| C1 | (earlier) | `schema.ts` becomes source of truth — new tables + nullable tenant columns, additive, no drops |
| C2 | (earlier) | Auth/tenant resolution — `getAuthContext()`, `is_platform_admin` gate, server-side PKCE callback |
| C3.0 | `1650ef5` | `requireTenantContext()` helper; migrated transactions + tables **GET** to org/location scoping |
| C3.1 | `52d1542` | tables **POST** tenant stamping; added QR **ownership check** (was missing) |
| C3.2 | `b816834` | checks **GET/POST** — transaction-wrapped insert, tenant stamping, table-ownership 404 |
| C3.3 | `efd7daa` | refunds (cross-tenant ownership guard, transaction, Stripe idempotency) + Stripe routes → location |
| C3.4 | `b03e668` | venue + onboard routes → org/location split; removed legacy `getUserVenue`; deleted dead `link-user` route |

**`[C2 + C3]` is the deployed "dashboard" unit.** The merchant dashboard + its API are now
fully on the canonical schema.

**Still pending inside Phase C** (verified in code — not yet started):

- **C4 — money path.** `app/pay/[tableId]/page.tsx`, `app/api/checkout/route.ts`,
  `app/api/webhooks/stripe/route.ts`, `lib/payments/*`, `lib/email.ts` still resolve via
  `check.venue` and legacy config. Riskiest piece: webhook Stripe-account matching on
  `locations.stripeAccountId`.
- **C5 — admin pages.** `app/admin/*` + `app/api/admin/payouts/route.ts` still count/join over
  venues; payouts insert needs org/location.
- **C6 — POS libs + scripts.** `lib/pos/*` lookups and `scripts/*` (incl. `seed.ts`,
  `onboard.ts`) still create/read the legacy `venues` path. These are the real
  customer-creation path, so they matter before scaling onboarding.

---

## 5. What's left before pilot

**Finish Phase C:** C4 (money path) → C5 (admin) → C6 (POS/scripts), each test-and-commit,
C4 as its own money-path release watched on Sentry. Detail in `docs/PHASE_C_PLAN.md` §C4–C6.

**Then the phases that are explicitly OUT of Phase C scope** (per `PHASE_C_PLAN.md` and
`ARCHITECTURE.md`) — these are the hardening phases before a real pilot. The detailed plans
for D–G are **not yet written** (Phase C is the only one with a plan doc); the scope below is
what the architecture doc already commits us to:

- **Phase D — RLS.** `ARCHITECTURE.md` hard-rule #5 requires Row-Level Security on every
  tenant-scoped table, filtered by the user's Memberships, bypassed only in `/admin/*` via the
  service-role key. Not implemented today; app-level scoping (`requireTenantContext`) is the
  only isolation right now. **This phase has a real open design question — see §8. It needs
  your input first.**
- **Phase E — payment safety.** Sentry wired for client+server (mandatory before real
  payments), all Stripe webhook receipts/failures + refunds logged, and the concurrency
  guarantee proven: two guests on the same QR must never double-charge or orphan an item
  (Postgres `SELECT … FOR UPDATE` inside the claim transaction). Overlaps with finishing C4.
- **Phase F — auth switch.** Move restaurant users from magic-link to **email+password +
  Google OAuth**; keep magic-link + **mandatory TOTP** for platform admins. Magic-link for
  restaurant users is a listed anti-pattern ("was tried, caused problems"). Phase C
  deliberately swapped *identity resolution* only, not the transport.
- **Phase G — QR / admin hardening.** QR codes must encode **signed, rotatable tokens**, not
  raw table UUIDs (`ARCHITECTURE.md` §QR); and create the **`admin_audit_log`** table (doesn't
  exist in any migration yet) so every platform-admin write is logged. C3.1 already added the
  QR *ownership* check; signed tokens are the remaining piece.

**Pre-pilot checklist** (gate before onboarding a paying restaurant):
- [ ] Phase C finished (C4–C6) and deployed.
- [ ] RLS enabled on tenant-scoped tables (Phase D) — or an explicit, signed-off decision to
      pilot on app-level scoping only.
- [ ] Sentry live in production (hard requirement before real money).
- [ ] Restaurant-user auth on password + Google; admin on magic-link + TOTP (Phase F).
- [ ] QR signed tokens + `admin_audit_log` (Phase G).
- [ ] The **3 deferred must-run tests** below all executed green.

---

## 6. Known landmines & deferred must-run tests

**Landmines carried in `PHASE_C_PLAN.md` (from the C2 audit) — internalize these:**

1. **Multi-org owners resolve differently now.** The old `getUserVenue()` had no `orderBy` →
   picked an *arbitrary* venue for a user with several. `getAuthContext()` is deterministic
   (`org_admin` first, then most-recent). Consequence: **test tenant-scoped work on a fresh
   single-org account**, never on a multi-org owner (the founder account `castillotoro3@gmail.com`
   owns 3 orgs and will mask bugs).
2. **`location = null` / `locationAmbiguous` is real.** `getAuthContext` returns a null location
   when an org-wide role's org has 0 or >1 active locations. `requireTenantContext({location:
   "required"})` turns that into a clean 409; org-only routes use `"optional"`. Never stamp a
   `location_id` without going through it.
3. **Legacy `venue_id` is still `NOT NULL` + FK.** `tables`/`checks`/`integrations` still
   require a `venues` row. The migrated inserts stamp `venueId = location.id` (works because
   backfill set `locations.id == venues.id`), and the C3.4 create-path **dual-writes** a
   `venues` + `venue_user` row so new tenants stay FK-valid until the contract migration. Don't
   "clean up" these legacy writes before C6/contract — they're load-bearing.
4. **Migrations are hand-written; `db:generate` lies.** The `drizzle/meta` snapshots were never
   maintained past `0000`, so `db:generate` re-emits the entire multi-tenant DDL as a phantom
   migration. **Discard generated files.** And **never `db:push` against a real DB** — that's
   what caused the original schema drift (`AGENTS.md` §"Migration discipline").
5. **Doc-vs-reality correction found in C3.4:** `onboarding_complete` exists **only on
   `organizations`** (it's the redirect gate `getAuthContext` reads); `locations` has no such
   column, despite a backfill note that implies "both." Set it on the org.

**Three deferred pre-pilot MUST-run tests** (recorded in `PHASE_C_PLAN.md` §C3):

1. **Live happy-path refund** on a real C3-owned payment — the guard's *allow* branch + the DB
   transaction effects (refund row, payment status, check rollback). Blocked so far because no
   such payment exists yet; run once a check flows check → guest pay.
2. **Connect-path refund** (`reverse_transfer: true` + `refund_application_fee: true`) once a
   `stripe_connect` tenant has a real Stripe **test** payment (the C3 test tenant is
   `aggregator`, so it never exercises this branch).
3. **C3.4 create-path smoke test** — the `venue` POST (Option A) is *not* hit by the single-org
   seed account (it already has a venue, so GET succeeds and POST never fires). Run once with a
   genuinely new signup and confirm all 7 rows land atomically (organization, venue, location
   with `id == venue.id`, users row + link, membership `org_admin`, venue_user, manual
   integration) and the returned object renders the settings form.

---

## 7. Run it locally

```bash
nvm use            # Node 20.10.0 (see AGENTS.md)
npm install
cp .env.example .env.local   # then fill in real values (see below)
npm run dev        # http://localhost:3000
```

**The DB connection split (important):** we run against Supabase's poolers with two URLs.

- **`DATABASE_URL` → transaction pooler, port `:6543`.** This is the app runtime connection.
  The Drizzle client sets **`prepare: false`** (`lib/db/index.ts`) because PgBouncer transaction
  mode does **not** support prepared statements — without it you get "prepared statement already
  exists" under load. Don't remove it.
- **`DIRECT_URL` → session pooler / direct, port `:5432`.** Used **only** by drizzle-kit
  (`db:migrate`, `db:studio`); see `drizzle.config.ts`. Migrations need a real session, not the
  transaction pooler.

Useful scripts (all wrap `dotenv -e .env.local`):
```bash
npm run db:studio     # browse the DB (drizzle-kit, via DIRECT_URL)
npm run db:migrate    # apply hand-written migrations (DIRECT_URL) — never db:push on a real DB
npm run db:seed       # scripts/seed.ts — NOTE: still legacy venues path (C6 not done)
```

**Test account:** use a **fresh single-org account** for dashboard testing (landmine #1) — the
C3 work was verified against the single-org "C3 Test Co" tenant. Do **not** use the founder
account (`castillotoro3@gmail.com`, 3 orgs) — deterministic resolution will pick one org and
hide multi-tenant bugs.

**Magic-link inbox gotcha (current auth):** login is passwordless magic-link/OTP today.
- The email must be **pre-registered** — `app/api/auth/login/route.ts` gates on the canonical
  `users` table (with a temporary `venue_users` fallback until C6). An unknown email gets a
  **403 "not registered"**, not an email. So seed/register the account first.
- It's a real email round-trip: you need access to that address's **inbox** to click the link —
  use an inbox you control for test accounts.
- The callback is a **server-side Route Handler** (`app/auth/callback/route.ts`), not a client
  component. The old client-component version double-fired under React Strict Mode and consumed
  the one-time PKCE verifier ("PKCE code verifier not found in storage"). Keep it server-side.
- This whole transport is temporary — Phase F moves restaurant users to password + Google.

---

## 8. The RLS design question — needs your call (Phase D)

This is the first real fork where I want your input before building.

**What the architecture commits us to:** `ARCHITECTURE.md` hard-rule #5 — RLS on every
tenant-scoped table, every query auto-filtered by the user's Memberships, bypassed only in
`/admin/*` via the service-role key.

**Why it's not a drop-in:** Supabase RLS policies are written against `auth.uid()` /
`auth.jwt()`, which are populated from the **Supabase client's** JWT on each request. **We don't
query through the Supabase client.** We query through **Drizzle over `postgres.js`** on a single
`DATABASE_URL` connection through the **transaction pooler** (`lib/db/index.ts`). On that raw
connection there is no per-request auth context, so as written the policies have nothing to key
on — and depending on the DB role, the connection may simply **bypass RLS** entirely. Today the
*only* tenant isolation is app-level: `requireTenantContext()` + explicit
`WHERE organization_id/location_id = …` in each route.

**The question for you:** how do we make RLS actually enforce isolation given this data path?
Options to weigh (not yet decided):

- **Inject per-request identity into the DB session** — e.g. `SET LOCAL app.current_user_id =
  …` (or `request.jwt.claims`) at the start of each request's transaction, and write policies
  against that. Interacts with **transaction-pooler** semantics: `SET LOCAL` must live inside
  the same transaction PgBouncer keeps pinned, so every RLS-guarded query would need to run in a
  transaction that first sets the GUC.
- **Run the app under a non-privileged DB role** so RLS is not bypassed, and grant it only what
  policies allow (we may currently connect as a role that bypasses RLS — worth confirming
  first).
- **Route tenant reads/writes through the Supabase client** (PostgREST or supabase-js with the
  user JWT) for RLS-guarded paths, keeping Drizzle for admin/service paths — a bigger
  architectural change.
- **Defense-in-depth, phased:** keep app-level scoping as the enforced boundary for the pilot
  and add RLS as a second layer once the identity-injection mechanism is chosen — with an
  explicit sign-off that the pilot ships without DB-enforced RLS.

Bring your prior on this — it sets how D is built and whether it blocks the pilot.

---

*Questions or anything stale here → flag it. `ARCHITECTURE.md` and `PHASE_C_PLAN.md` are the
authoritative docs; this one is the on-ramp.*
