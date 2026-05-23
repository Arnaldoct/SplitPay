# SplitPay — Agent Instructions

## What We're Building

**SplitPay** is a pay-at-table product for restaurants, modeled on Sunday (sundayapp.com). Guests scan a QR code at their table, view the live check from the restaurant's POS, choose how to split the bill, and pay via Apple Pay, Google Pay, or card through Stripe. No app install required — it's a mobile-first PWA.

**Revenue model**: Small commission on every transaction via Stripe Connect.

**Brand**: Deep purple/aubergine + warm cream paper. Editorial serif (Fraunces) + Inter. Hospitality-luxury aesthetic. Marketing site is live at splitpayusa.com — this repo is the product app, not the marketing site.

## Team Context

- **Arnaldo**: Co-founder, operator with deep product understanding. Can read code and learns fast, but needs you to do implementation heavy lifting.
- **You (AI agent)**: Pair programmer. Explain what you write after you write it. When making architectural choices, explain the tradeoffs considered. Work in focused chunks, not 500-line dumps.

## Tech Stack (Locked In)

Do not deviate from this stack without explicit approval:

- **Framework**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Database**: Postgres on Supabase (also handles auth + realtime)
- **ORM**: Drizzle
- **Payments**: Stripe + Stripe Connect (Express onboarding for restaurants)
  - **v1 constraint**: Use Stripe Checkout (hosted), NOT Elements. This keeps us in PCI SAQ A scope.
- **Email**: Resend for transactional (receipts, magic links)
- **Background jobs**: Inngest (when needed — not yet)
- **QR generation**: `qrcode` npm package, server-side
- **Realtime check state**: Supabase Realtime
- **Hosting**: Vercel
- **Repo**: GitHub

## Architectural Principles

1. **Guests never sign in**. No accounts, no login. They scan, they pay, they leave. This is a hard product decision.
2. **Real-time bill locking matters**. Two phones at the same table cannot double-claim the same item. Every claim is a DB transaction with row-level locks.
3. **Fake the POS integration for v1**. Build a `POSAdapter` interface from day one, but the first implementation is a "ManualAdapter" where the restaurant enters checks via our merchant dashboard. Square is the first real integration (best public sandbox). Clover is second. Toast, Aloha, Lightspeed are months 3+.
4. **Refunds and disputes must be day-one features**, not Phase 2. The merchant dashboard needs a refund button before we sign our first venue.
5. **Mobile-first, always**. Guest UI is designed for thumb-sized targets on a phone in a dim restaurant.

## How the Product Works

1. QR code at each restaurant table encodes a table identifier
2. Guest scans → opens a mobile web page (PWA, no app install)
3. Page renders the open check pulled from the restaurant's POS, itemized
4. Guest picks a split method:
   - Pay full
   - Split evenly
   - Split by item
   - Custom amount
5. Guest pays via Apple Pay, Google Pay, or card through Stripe
6. Tip is selected from precalculated suggestions before checkout
7. Receipt emailed instantly; the POS gets the payment reconciled back as one or more partial payments
8. When the check zeroes out, the table is cleared

## Hard Constraints

- **PCI scope**: Stripe Checkout only for v1. No raw card data ever touches our servers or our code.
- **No native mobile app**. PWA only. Don't propose React Native, Expo, etc.
- **No CSS frameworks beyond Tailwind**. No Material UI, no Chakra, no shadcn unless we explicitly decide to add it later.
- **Currency**: USD only for v1. All amounts stored as **integers in cents**.
- **Times**: All times in UTC in the DB, formatted to venue's local timezone in the UI.

## 8-Week Roadmap

**Current stage**: Stage 4

- ✅ **Stage 1**: Scaffolding (Next.js + Tailwind + TypeScript)
- ✅ **Stage 2**: Accounts created (GitHub, Supabase, Stripe, Vercel)
- ✅ **Stage 3**: Dev environment ready (Node 20.10.0, npm 10.2.3, Git)
- 🔄 **Stage 4**: Wiring — Supabase project created, env vars set, Stripe test keys added, Drizzle installed, first DB schema written, Git/GitHub initialized
- **Stage 5**: Database schema — Venues, users, tables, checks, check_items, payments, claims, payouts, refunds, integrations. Row-level security policies on Supabase.
- **Stage 6**: Guest pay flow happy path — Hardcoded check in DB → scan QR → see check → "Pay full" → Stripe Checkout → success page. End-to-end.
- **Stage 7**: Four split modes — Even / by-item / custom. Locking. State machine.
- **Stage 8**: Merchant dashboard — Auth (Supabase magic link), venue/table CRUD, QR codes, manual check entry, transaction history, Stripe Connect Express onboarding.
- **Stage 9**: Tips, receipts, Apple/Google Pay polish.
- **Stage 10**: Square POS integration.
- **Stage 11**: Pilot with one restaurant. Fix the 30 things we didn't anticipate.
- **Stage 12**: Harden + Clover integration.

## How to Work With Arnaldo

- **Stage by stage**. Don't skip ahead.
- **Run commands yourself**. You have permission to execute shell commands, just show the diff first.
- **Pause at real forks in the road** (design decisions, not stylistic ones) and ask.
- **Add a comment block** at the top of any non-obvious file explaining what it does and why.
- **Tests**: Write tests for the financial logic (split calculations, refunds, locking) starting in Stage 7. Skip tests for UI plumbing.
- **When something fails**: Read the error, hypothesize the cause, propose a fix. Don't guess.

## Environment

- **Location**: `~/Projects/splitpay`
- **Dev server**: `npm run dev` on `localhost:3000`
- **Node**: 20.10.0
- **npm**: 10.2.3
- **OS**: macOS (darwin 24.5.0)

## Key Files to Create

As we progress, we'll need:

- `.env.local` (gitignored) — Supabase, Stripe keys
- `drizzle.config.ts` — Drizzle ORM config
- `src/db/schema.ts` — Drizzle schema definitions
- `src/lib/pos-adapter/` — POS integration interface + adapters
- `src/lib/stripe.ts` — Stripe client
- `src/lib/supabase/` — Supabase client utilities
- `src/app/pay/[tableId]/` — Guest pay flow pages
- `src/app/dashboard/` — Merchant dashboard
- `src/app/api/webhooks/stripe/` — Stripe webhook handler

## Current Status (May 22, 2026)

- Project scaffolded with `create-next-app@latest` using TypeScript, ESLint, Tailwind, App Router, no src/ directory
- Dev environment ready
- Accounts created but not yet wired up
- Git not yet initialized
- Ready to begin Stage 4
