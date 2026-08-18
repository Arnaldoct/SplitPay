# SplitPay Architecture — Source of Truth

**Last updated:** 2026-05-25
**Owner:** Arnaldo Castillo Toro

This document defines how SplitPay is built. Any deviation from what's written here should be intentional and documented — not accidental.

## Product summary

SplitPay is a pay-at-table product for restaurants, modeled on Sunday (sundayapp.com). A guest scans a QR at their table, sees their check itemized, picks how to split it, and pays via Apple Pay / Google Pay / card. The restaurant's POS gets the payment reconciled back automatically. SplitPay takes a small commission on every transaction.

## Stack

- **Framework**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Hosting**: Vercel (auto-deploys from GitHub main, preview deploys on PRs)
- **Database**: Postgres on Supabase
- **ORM**: Drizzle
- **Auth**: Supabase Auth (email + password + Google OAuth for restaurant users; magic link + TOTP for platform admins)
- **Payments**: Stripe + Stripe Connect (Express accounts). Use Stripe Checkout (hosted), NOT Elements. This keeps us in PCI SAQ A scope.
- **Email**: Resend (transactional receipts, password resets)
- **QR generation**: `qrcode` npm package, server-side, encoding signed tokens (not raw UUIDs)
- **Background jobs**: Inngest (add when needed; not yet required)
- **Error tracking**: Sentry (mandatory in production, must be in place before real payments run)
- **Analytics**: PostHog (add in Stage 8)
- **Repo**: GitHub, main branch is production

## Multi-tenancy hierarchy

Every restaurant business is an **Organization**. Every physical restaurant is a **Location**. Every table is a **Table**. Every open bill is a **Check**.

```
Organization (restaurant business / brand)
  ├── Location (single physical restaurant — has its own address, timezone, Stripe Connect account, POS integration)
  │     ├── Table (physical table, one QR code)
  │     │     └── Check (open bill with items, payments, status)
  │     └── POSIntegration (one per location — ManualAdapter by default)
  └── Membership (links Users to this Organization with a Role)
```

**Roles**: `org_admin`, `location_manager`, `server`, `accountant`.

### Hard rules:

1. Even a single-location restaurant gets both an Organization row and a Location row. Never collapse them.
2. Stripe Connect accounts attach at the **Location** level, never Organization.
3. SplitPay billing (our commission invoicing) is at the **Organization** level.
4. POS integrations attach at the **Location** level. Each location has one active POSIntegration.
5. Row-Level Security (RLS) is enabled on every tenant-scoped table. Every query is filtered by the user's Memberships automatically. RLS is never bypassed except in `/admin/*` routes using the Supabase service role key.
6. Guests are NOT Users. They have no row in the users table. They appear only as the payer email on Payment rows.

## Platform admin layer

SplitPay (your team) is **not** modeled as an Organization. Instead:

- `users` table has an `is_platform_admin BOOLEAN NOT NULL DEFAULT false` column. Manually set to true for SplitPay team members.
- All admin functionality lives under `/admin/*`, protected by middleware that checks `is_platform_admin`.
- On `/admin/*` routes, queries use the Supabase service role key to bypass RLS. The service role key is **never** used anywhere else in the codebase.
- Every write action by a platform admin is logged to an `admin_audit_log` table with `admin_user_id`, `action`, `target_organization_id`, `target_resource`, `metadata`, `created_at`.
- The admin dashboard covers: customer onboarding (create Organizations, send invites, walk through Stripe Connect), live transaction monitoring across all restaurants, support tools (view any check, issue refunds, impersonate customers with audit logging), financial ops (platform GMV, commission revenue), and per-Organization configuration.
- Future: `region_admin` role for Country Partners (v2, not now).

## Authentication

- **Guests**: no auth ever. QR scan → pay → leave. No accounts, no login.
- **Restaurant users** (`org_admin`, `location_manager`, `server`, `accountant`): Supabase Auth with email + password + "Continue with Google" as secondary option. No magic links.
- **Platform admins**: Supabase Auth with magic link + mandatory TOTP 2FA.
- All three types share the same `users` table, distinguished by Memberships and the `is_platform_admin` flag.

## Guest pay flow

1. Guest scans QR at Table N. URL: `https://app.splitpayusa.com/pay/t/[signedToken]`
2. Server validates the signed token, resolves to a Table, finds the open Check.
3. Renders itemized check with four split options: Pay full / Split evenly (2–N ways) / Split by item / Custom amount.
4. Guest selects items or enters amount. Tip suggestions (18/20/22/25%) presented.
5. Guest taps "Pay $X.XX." Redirects to Stripe Checkout (hosted).
6. Apple Pay / Google Pay / card. Guest confirms.
7. Stripe webhook fires to `/api/webhooks/stripe`. Handler verifies signature, creates a Payment row, decrements Check's `remaining_amount`, releases any locked items, calls POS adapter's `postPartialPayment`.
8. If `remaining_amount` hits 0, mark Check as `paid`, free the Table.
9. Guest sees success page. Receipt sent via Resend. Optional Google review prompt.

**Concurrency**: two guests scanning the same QR must resolve deterministically — never double-charge, never orphan an item. Handled with Postgres row-level locks (`SELECT ... FOR UPDATE`) inside transactions when claiming items.

## POS integration pattern

A single TypeScript interface `POSAdapter` with methods:

- `fetchOpenCheck(externalTableId)`
- `postPartialPayment(checkExternalId, amountCents, paymentId)`
- `voidPayment(externalPaymentId)`

Implementations, in order of build:

1. **ManualAdapter** — restaurant enters checks via merchant dashboard. This is the default and what all v1 pilots use.
2. **SquareAdapter** — first real integration (best sandbox, easiest onboarding).
3. **ToastAdapter** — second (larger customer base but months-long partner application).
4. **CloverAdapter**.
5. **LightspeedAdapter**.

Each new POS is one new class implementing the interface. No other code changes.

## Stripe

- Stripe Checkout (hosted), never Elements. Keeps us in PCI SAQ A scope.
- Stripe Connect Express accounts, one per Location.
- Express onboarding embedded in merchant dashboard.
- Webhook handler at `/api/webhooks/stripe` verifies signatures using `STRIPE_WEBHOOK_SECRET`.
- Refund flow: every Payment row has a refund button on the merchant dashboard. Refunds call `stripe.refunds.create()` and update the Payment row via webhook.
- Chargebacks: contractually the restaurant's responsibility, not SplitPay's, per merchant agreement.

## QR codes

- Generated server-side using `qrcode` npm package.
- Encode a URL with a signed token, not the raw table UUID. Signed tokens are unguessable and rotatable.
- Merchant dashboard can regenerate a QR (e.g. if physical QR is damaged).
- PDF export for printing — one QR per table on standard letter paper, with table numbers labeled.

## Merchant dashboard (`/dashboard/*`)

Required routes:

- Organization + Location management (CRUD)
- Table management + QR generation + PDF export
- Manual check entry (for ManualAdapter — restaurant staff enters check items)
- Transaction history with refund button on every row
- Stripe Connect Express onboarding embed
- Team management (invite users, assign roles)

## Environment variables

The following env vars are required. Missing any of these in production must fail the build loudly, not silently.

| Variable | Scope |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only, never exposed |
| `DATABASE_URL` | Server only |
| `STRIPE_SECRET_KEY` | Server only |
| `STRIPE_WEBHOOK_SECRET` | Server only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-safe |
| `RESEND_API_KEY` | Server only |
| `NEXT_PUBLIC_APP_URL` | Client-safe |
| `SENTRY_DSN` | Both client and server |

Any env var not prefixed with `NEXT_PUBLIC_` must never appear in client components.

## Anti-patterns (never do these)

- Use of Supabase service role key outside `/admin/*` routes.
- Stripe Elements or any card entry on our domain (must be Stripe Checkout).
- Guest accounts, guest login, or any auth requirement for guests.
- Native mobile apps for guests (PWA only).
- Collapsing Organization and Location into a single entity.
- Magic-link auth for restaurant users (was tried, caused problems, use passwords).
- JSX inside try/catch blocks (broke our Vercel deploy; use error boundaries instead).
- Direct SQL bypassing Drizzle (except in migrations).
- Hardcoded IDs, test emails, or dev-mode toggles that aren't gated by NODE_ENV.
- `console.log` in production code paths (use structured logging).

## Observability requirements

- Sentry integrated for both client and server, capturing all unhandled exceptions.
- All Stripe webhook receipts and failures logged.
- All refunds logged with actor (restaurant user vs platform admin) and reason.
- All platform admin actions logged to `admin_audit_log`.
- Vercel Analytics enabled for Core Web Vitals.

## Scope explicitly deferred

Not in v1. Not until explicitly promoted:

- Self-service restaurant signup (concierge onboarding for first 50+ customers).
- Customer accounts / loyalty programs.
- Server leaderboards, tipping gamification.
- Multi-currency (USD only for v1).
- Native mobile apps.
- GraphQL layer.
- Multi-region deploys.
