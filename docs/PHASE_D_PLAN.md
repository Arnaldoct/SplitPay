# Phase D — Execution Plan: Row-Level Security (RLS)

**Status:** DRAFT for CTO review — **planning only, nothing built.**
**Owner:** Arnaldo Castillo Toro · **Created:** 2026-09-14
**Reviewers:** incoming CTO (please stress-test §1 and §7 especially)

Phase D adds **database-enforced** tenant isolation on top of the app-level scoping that
Phase C shipped (`requireTenantContext()` + explicit `WHERE organization_id = …`). Goal: even a
buggy or malicious query from the app can't read or write another tenant's rows. This closes
`ARCHITECTURE.md` hard-rule #5 (RLS on every tenant-scoped table, filtered by the user's
Memberships, bypassed only in `/admin/*`).

Read alongside: `docs/ARCHITECTURE.md` (§Multi-tenancy, §Platform admin), `docs/CTO_ONBOARDING.md` §8.

---

## 0. Ground state (measured, not assumed)

I probed the live DB read-only on 2026-09-14 over the transaction pooler. Findings drive the
whole plan:

| Fact | Value | Why it matters |
|---|---|---|
| App runtime role | **`postgres`** | This is who every Drizzle/`postgres.js` query runs as. |
| `rolbypassrls` | **`true`** | **RLS is completely inert for us today.** Enabling RLS + policies changes nothing until we stop connecting as this role. |
| `rolsuper` / `is_superuser` | false / off | Not a superuser, but `BYPASSRLS` alone is enough to skip all policies. |
| Tables with RLS enabled | **none** | Clean slate. |
| Existing policies | **none** | — |
| `SET LOCAL` (`set_config(k,v,true)`) inside one txn | holds across **all** statements in the txn; reads back correctly | Viable per-request tenant context on the pooler. |
| Same GUC read **after** the txn | empty (`''`) | `SET LOCAL` does **not** persist or leak across requests. Good. |
| Session `SET` (`set_config(k,v,false)`) | **leaked into the next query** in the probe | A plain connection-level SET is **unsafe** on a multiplexed pooler — do not use it. |

Connection facts (from `lib/db/index.ts`, `.env.example`, `drizzle.config.ts`):
- Runtime: `DATABASE_URL` → transaction pooler `:6543`, `prepare:false`, connections multiplexed.
- Migrations/studio: `DIRECT_URL` → session pooler/direct `:5432`.

**Two schema surprises to resolve first:** the DB has `auth_sessions` and `menu_items` tables
that are **not in `lib/db/schema.ts`**. Before enabling RLS we must classify every `public` table
as tenant-scoped / global / legacy / dead — a table left un-classified is either an isolation
hole (RLS off) or a silently broken feature (RLS on, no policy). See §2 and §6.

---

## 1. The core design question — how RLS learns the current tenant

**Problem.** RLS policies need to know "who is asking" per query. Supabase's usual answer is
`auth.uid()` / `auth.jwt()`, populated from the **Supabase client's** JWT. **We don't use the
Supabase client for data** — we use Drizzle over `postgres.js` on one shared role through the
**transaction pooler**, which multiplexes many logical requests over few backends. So there is
no ambient per-request identity, and any naive connection-level state can bleed between requests.

### The options, with tradeoffs for *our* setup

**Option A — `SET LOCAL` inside a per-request transaction (RECOMMENDED).**
Open a transaction, `set_config('app.user_id', …, true)` (and/or `app.org_id`) as the first
statement, run the request's queries, commit. Policies read `current_setting('app.user_id', true)`.
- ✅ **Proven on our pooler:** the probe showed the GUC holds across every statement in the txn
  and is gone afterward — the transaction pooler pins one backend for the life of a transaction,
  which is exactly the unit `SET LOCAL` needs. No cross-request leak.
- ✅ Works with `prepare:false` and the existing `db.transaction(...)` API.
- ⚠️ **Every tenant-scoped query must run inside a transaction** — including single reads. We
  centralize this in one helper (`withTenant(ctx, fn)` / a `db` wrapper) so no route hand-rolls it.
  Single-statement reads become 1-txn round-trips; acceptable, but measure.
- ⚠️ Requires the app to connect as a **non-`BYPASSRLS`** role (see §0) — otherwise the GUC is
  set but policies are skipped.

**Option B — request-scoped dedicated connection with a session `SET`.**
Check out one backend per request, `SET` (not LOCAL) the identity, hold it for the request.
- ❌ We can't pin a backend per request through the **transaction** pooler — it hands out a
  backend per *transaction*, not per request. The probe showed a session `SET` leaking to the
  next query: on a multiplexed pool that same leak reaches *other tenants'* requests. Unsafe.
- ❌ Getting real per-request connections means the **session** pooler (`:5432`) or direct
  connections — which defeats serverless multiplexing and will exhaust Postgres connections under
  Vercel's fan-out. Rejected for our topology.

**Option C — pass `org_id` as an explicit predicate (status quo, app-level only).**
This is what Phase C already does (`WHERE organization_id = ctx…`). It is **not** RLS — a missing
or wrong `WHERE` leaks. Keep it as the first layer, but it is not the DB-enforced guarantee Phase D
is for.

**Option D — route tenant queries back through the Supabase client (PostgREST/supabase-js).**
Then `auth.uid()` works natively.
- ❌ Large architectural reversal: we'd rewrite data access away from Drizzle, split the codebase
  across two query layers, and lose typed Drizzle queries on the hot paths. Not worth it.

**Option E — hybrid (RECOMMENDED overall): A + C.**
Keep the app-level `WHERE organization_id` (fast, explicit, already shipped) **and** enforce RLS
via Option A as defense-in-depth. App bug in the `WHERE`? RLS still blocks it. RLS context bug?
The `WHERE` still scoped it. Two independent layers, each a backstop for the other.

### Recommendation

**Adopt Option E: `SET LOCAL` GUCs inside a per-request transaction (Option A), under a dedicated
non-`BYPASSRLS` role, layered over the existing app-level scoping (Option C).**

Concretely, two GUCs set at the top of each request transaction:
- `app.user_id` — the authenticated `users.id` (empty string for guest/webhook/system).
- `app.org_id` — the resolved active organization; set for **unauthenticated-but-trusted**
  contexts (guest after signed-token validation, webhook after event→org resolution). For a
  logged-in dashboard user it's optional — the membership subquery (below) is the real authority.

Policies key on the user's memberships (matching ARCHITECTURE's "filtered by the user's
Memberships automatically"), with an `app.org_id` branch for the trusted no-user contexts:

```sql
-- reusable predicate for org-scoped tables
organization_id IN (
  SELECT m.organization_id FROM memberships m
  WHERE m.user_id = nullif(current_setting('app.user_id', true), '')::uuid
    AND m.active
)
OR organization_id = nullif(current_setting('app.org_id', true), '')::uuid
```

Note `current_setting(…, true)` returns `''` when unset, so **every** cast must be
`nullif(…, '')::uuid` or the policy errors instead of denying. (Empty context ⇒ both branches
false ⇒ zero rows — see the silent-empty risk in §5.)

### The bootstrap / ordering problem (must design around)

Some queries run **before** any tenant context exists:
- **Login** (`app/api/auth/login/route.ts`) looks up a user by email pre-auth.
- **`getAuthContext()`** reads `users`/`memberships`/`organizations`/`locations` *to resolve* the
  org — it can't already know the org.
- **Guest** resolves table→check from a QR token before knowing the org.
- **Webhook** resolves org from `locations.stripeAccountId` / event metadata.

Resolution:
1. Set `app.user_id` from the session **first thing** in the request txn; make the `memberships`
   and `users` policies answerable by `app.user_id` alone (not `app.org_id`). Then `getAuthContext`
   works — it only ever reads the calling user's own memberships/user row.
2. **Guest**: once QR codes carry a **signed token that encodes location/org** (Phase G), the
   server decodes `org_id` with no DB read, sets `app.org_id`, then queries. Until Phase G, the
   raw-`tableId` lookup needs a narrow, read-only bootstrap path (see §3 system context).
3. **Webhook**: signature-verified server context → resolve org via the **system/bypass** path
   (§3), then set `app.org_id` for the scoped writes.
4. **Pre-auth login lookup** hits `users`/`venue_users`; keep those answerable without org context
   (user-id/email keyed, or — for legacy `venue_users` — RLS deferred until C6/contract).

### What I want the senior engineer to confirm (blocking)

1. **Can we connect through the Supabase transaction pooler as a custom, non-`BYPASSRLS` role?**
   Supabase's pooler auth uses `postgres.<project-ref>`; we need the equivalent for an
   `app_user` role (or a documented way to route a non-`postgres` role through `:6543`). **This is
   the #1 unknown — the whole phase is blocked on it.** If the pooler only accepts `postgres`,
   we need an alternative (dedicated non-bypass role reachable another way, or Supabase support).
2. **Transaction-pooler backend pinning under load/concurrency** — the probe proved a single
   transaction holds one backend; confirm this stays true under Vercel concurrency and that
   Drizzle `db.transaction()` issues a real `BEGIN/COMMIT` (not autocommit) on one pooled backend.
3. **Policy shape:** membership-subquery-per-query (authoritative, but a join on every read) vs.
   a resolved `app.org_id` GUC (faster, but trusts app code to set it right). I lean subquery for
   authenticated + `app.org_id` for guest/webhook; confirm the perf tradeoff is acceptable with
   the `memberships(user_id)` and `*_organization_id_idx` indexes we already have.
4. **Guest/webhook context** strategy above, and its dependency on Phase G signed tokens.

---

## 2. Which tables get RLS, and the policy logic

**Enable RLS + `FORCE ROW LEVEL SECURITY`** on every org-scoped table. `FORCE` makes the policy
apply even to the table owner; combined with an app role that lacks `BYPASSRLS`, that's belt-and-
suspenders. All these carry `organization_id` (verified in `schema.ts`):

| Table | Scope column | Policy predicate (USING and WITH CHECK) |
|---|---|---|
| `organizations` | `id` | `id` matches the org predicate (self) |
| `locations` | `organization_id` | org predicate |
| `memberships` | `organization_id` + `user_id` | `user_id = app.user_id` **OR** org predicate |
| `tables` | `organization_id` | org predicate |
| `checks` | `organization_id` | org predicate |
| `check_items` | `organization_id` | org predicate |
| `claims` | `organization_id` | org predicate |
| `payments` | `organization_id` | org predicate |
| `refunds` | `organization_id` | org predicate |
| `payouts` | `organization_id` | org predicate |
| `integrations` | `organization_id` | org predicate |

where **org predicate** = the reusable block from §1. Each table gets policies for `SELECT`,
`INSERT`, `UPDATE`, `DELETE` (or `FOR ALL`), and **`WITH CHECK` mirrors `USING`** so a tenant
can't *insert/update* a row into another org (not just read it).

**Special cases:**
- **`users`** — global identity, not org-scoped. v1 policy: `id = app.user_id` (you read only your
  own row). Teammate listing (`id IN (users in my org via memberships)`) is deferred until the
  team-management feature needs it.
- **`memberships`** — must be answerable by `app.user_id` alone (bootstrap; see §1).
- **Legacy `venues` / `venue_users`** — still read by the pre-C6 money path and the login
  fallback. **Do not enable RLS on them in Phase D**; they carry no `organization_id` and their
  reads happen pre-context. They're removed at the contract migration; RLS on them is moot.
- **`auth_sessions`, `menu_items`** — **unknown, must classify before we ship.** If `menu_items`
  is location/org data, it needs a policy; if either is dead, drop it. Not in `schema.ts` today.

**Also required:** `GRANT SELECT/INSERT/UPDATE/DELETE` on the scoped tables (and `USAGE` on
sequences) to `app_user`. Custom `app.*` GUCs need no grant — any role may `SET LOCAL` them.

---

## 3. `/admin/*` bypass, and containing it

Platform admins are cross-tenant **by design** (support, refunds, monitoring). Two mechanisms:

1. **A separate, RLS-bypassing DB client** used only by admin code — e.g. `lib/db/admin.ts`
   exporting an `adminDb` built from a **service-role** connection string (a role with
   `BYPASSRLS`, i.e. today's `postgres`). Regular routes import `db` (the `app_user` client);
   admin routes import `adminDb`.
2. **Every admin write still authorizes in app code** via `requirePlatformAdmin()`
   (`lib/admin.ts`, `users.is_platform_admin`) — RLS bypass is not authorization; the gate is.

**Containment — how we keep the bypass out of tenant routes:**
- One module owns the service-role connection; it reads a distinct env var
  (`ADMIN_DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) that the normal client never touches.
- A **CI grep/lint rule**: `adminDb` (and the service-role env) may be imported only under
  `app/admin/**` and `app/api/admin/**`. Any other import fails the build. This operationalizes
  the existing `ARCHITECTURE.md` anti-pattern ("service role key never used outside `/admin/*`").
- Code review + the eventual middleware move of the admin gate (per Decision #6 / ARCHITECTURE).
- **Audit:** pairs with Phase G's `admin_audit_log` — every bypassed write logged with actor.

Open question for CTO: do admin reads that don't need cross-tenant (e.g. viewing one org) run on
`app_user` with `app.org_id` set instead, reserving `adminDb` for genuinely cross-tenant queries?
That shrinks the bypass surface.

---

## 4. Migration approach

**Hand-written SQL migration, applied via `DIRECT_URL` (`:5432`).** RLS DDL (`CREATE ROLE`,
`ALTER TABLE … ENABLE/FORCE ROW LEVEL SECURITY`, `CREATE POLICY`, `GRANT`) must run on a real
session, not the transaction pooler, and **`db:generate` does not emit RLS** — consistent with
the project's "migrations are hand-written; discard generated files; never `db:push` on a real DB"
discipline (`AGENTS.md`, `PHASE_C_PLAN.md`).

**Expand/verify pattern — the key insight that makes this safe:** because the app currently
connects as `postgres` (`BYPASSRLS`), **policies are inert until we flip the connection role.** So
we deploy in two independently-revertable steps:

- **D.1 — create role + enable RLS + policies (zero behavior change).** Create `app_user`
  (`NOLOGIN`? — see confirm-list; the pooler may need `LOGIN`), grant DML, `ENABLE`/`FORCE` RLS,
  create all policies. The live app (still `postgres`) is **unaffected** — nothing to break. Verify
  the policies in staging by connecting *as* `app_user` and running the §5 tests.
- **D.2 — flip the app to `app_user`.** Change `DATABASE_URL` to authenticate as `app_user`
  (Vercel env), keeping `:6543`/`prepare:false`. Now RLS is live. Wrap all tenant queries in the
  `withTenant` transaction (that app change ships with D.2).

Migrations still run as `postgres` via `DIRECT_URL` (fine — migrations should bypass RLS). Dev
scripts (`scripts/*`, `db:seed`) also connect as `postgres` ⇒ they bypass RLS, which is
acceptable (they're admin/dev tooling) but should be a conscious, documented choice.

Down migration: `DROP POLICY …`, `DISABLE ROW LEVEL SECURITY`, `DROP ROLE app_user` — plus the
D.2 env flip back to `postgres`.

---

## 5. Test strategy — prove isolation at the database level

The bar: **as `app_user`,** tenant A cannot read or write tenant B, **and** legitimate queries
still return the right rows. Test against a seeded **two-tenant** DB, run over `DIRECT_URL` as
`app_user` (so RLS actually applies), plus app-level integration tests.

**Negative (isolation) — must all pass:**
- Context = A's user. `SELECT count(*) FROM checks` returns only A's count; selecting B's known
  check id returns **0 rows**. Repeat for every table in §2.
- `INSERT`/`UPDATE` a row with `organization_id = B` while context = A → **rejected** by
  `WITH CHECK` (not silently redirected).
- Context = `app.org_id = B` (guest path) cannot touch A.

**Positive (no over-restriction) — equally important:**
- With correct context, A sees **exactly** A's rows (assert counts equal a bypass-role baseline),
  every dashboard read/write path returns/writes what it should, and the guest + webhook paths
  work end-to-end.

**⚠️ The silent-empty-result risk (call this out loudly).** RLS makes unauthorized rows
**disappear**, it does not raise an error. Two failure modes, both silent:
1. **Context not set** (a code path that didn't open the `withTenant` txn, or set an empty GUC) ⇒
   *every* query returns empty ⇒ the app looks *empty/broken*, not *denied*. Easy to misdiagnose
   as data loss.
2. **Policy too permissive** ⇒ extra rows leak with no error.

Mitigations:
- **Assert context is set:** immediately after opening the request txn, `SELECT
  nullif(current_setting('app.user_id', true),'')` (and/or `app.org_id`); if both empty for a
  path that requires tenancy, **throw** — converting silent-empty into a loud 500 we can alert on.
- **Count-equality tests** (positive side) catch both over- and under-restriction.
- **Coverage test in CI:** assert every `public` table is either in the RLS set (RLS enabled +
  ≥1 policy) or on an explicit allowlist (global/legacy/dead) — so a new table can't silently ship
  without a policy. This is also where `auth_sessions`/`menu_items` get forced into a decision.
- Tooling: prefer **pgTAP** (or a SQL script) for the DB-level matrix, runnable in CI against a
  disposable seeded DB; plus API integration tests hitting tenant A's session against tenant B's
  ids (expect 404/empty).

---

## 6. Rollback plan & biggest risks

**Rollback (fast → full):**
1. **Instant:** flip `DATABASE_URL` back to the `postgres` (`BYPASSRLS`) role in Vercel. RLS is
   bypassed immediately, zero DDL, policies remain but inert. This is the panic button.
2. **Full:** run the down migration (`DROP POLICY` / `DISABLE RLS` / `DROP ROLE`) via `DIRECT_URL`.

Because D.1 is inert under `postgres` and D.2 is just an env flip, both directions are low-drama —
same "revertable by config/git, no data change" property Phase C relied on.

**Biggest risks:**
1. **Pooler can't carry a non-`BYPASSRLS` role** (§1 confirm #1) — if true, the whole approach
   needs rework. Resolve *before* building anything.
2. **Silent-empty lockout** — a missed code path returns empty and looks like data loss. Mitigated
   by the assert-context guard + path audit + count tests, but it's the most likely production
   incident.
3. **Uncovered / mystery tables** — `auth_sessions`, `menu_items`, and any future table without a
   policy = hole or breakage. Mitigated by the CI coverage test.
4. **Guest / webhook / bootstrap paths** — unauthenticated but must work; the hardest surface,
   and partly dependent on Phase G signed tokens. Under-design here breaks the money path.
5. **Performance** — membership-subquery on every read; validate with the existing indexes and
   realistic row counts before D.2.
6. **Legacy-table interplay** — `venues`/`venue_users` still in use pre-C6; keep them RLS-free and
   reachable (login fallback, guest money path) or those flows break.
7. **Every-query-in-a-transaction** ergonomics — if a route forgets `withTenant`, it either leaks
   (still `postgres`) or returns empty (`app_user`). The wrapper must be the *only* way to get a
   `db` handle for tenant data.

---

## 7. Open questions for the CTO (consolidated)

1. **Pooler + non-`BYPASSRLS` role** — can we authenticate `app_user` through `:6543`? (Blocking.)
2. **Policy authority** — membership-subquery vs. `app.org_id` GUC vs. the hybrid I recommend;
   perf acceptable?
3. **Guest/webhook context** — signed-token-carried `org_id` (needs Phase G) + a minimal system
   path for pre-context lookups. Agree?
4. **Admin bypass surface** — separate `adminDb` for genuinely cross-tenant only, with scoped
   `app_user` for single-org admin reads? Or all admin on bypass?
5. **`auth_sessions` / `menu_items`** — what are they, are they tenant data, are they live?
6. **Sequencing vs. Phase C** — do we finish C4–C6 (so guest/webhook/scripts are on the canonical
   schema and legacy tables are gone) **before** flipping RLS on (D.2)? I lean yes: RLS over a
   half-migrated money path multiplies the risk surface.

---

*This is a draft. Nothing here is built. Next step after CTO review: resolve §7 #1 (the pooler
role question) with a spike, then write the D.1 migration.*
