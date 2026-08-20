-- ============================================================================
-- Phase B — BACKFILL (data only; no DDL, no drops)
-- Populates organizations / locations / users / memberships and the new tenant
-- columns from the existing venues / venue_users data.
--
-- Key strategies (both approved):
--   1. locations.id = venues.id           -> every existing venue_id already
--      identifies the correct location; no UUID rewriting needed.
--   2. organization id is DERIVED deterministically as
--      md5(venue_id::text || ':org')::uuid -> no temp mapping tables, every
--      statement is self-contained and order-independent.
--
-- Safe to read against production: this migration is INSERT/UPDATE only and
-- touches no venue_* source data. Old columns stay populated for rollback.
-- ============================================================================

-- ---------- 1. organizations: one per venue (deterministic id) ----------
INSERT INTO "organizations"
	("id", "name", "slug", "legal_name", "business_type", "tax_id", "country",
	 "billing_email", "onboarding_complete", "active", "created_at", "updated_at")
SELECT
	md5(v."id"::text || ':org')::uuid,
	v."name",
	v."slug",
	v."legal_name",
	v."business_type",
	v."tax_id",
	v."country",
	v."email",
	v."onboarding_complete",
	v."active",
	v."created_at",
	v."updated_at"
FROM "venues" v;--> statement-breakpoint

-- ---------- 2. locations: id = venue id, org = derived org id ----------
INSERT INTO "locations"
	("id", "organization_id", "name", "slug", "stripe_account_id",
	 "stripe_onboarding_complete", "payment_model", "email", "phone", "address",
	 "city", "state", "zip", "timezone", "website", "logo_url", "brand_color",
	 "tip_suggestions", "active", "created_at", "updated_at")
SELECT
	v."id",
	md5(v."id"::text || ':org')::uuid,
	v."name",
	v."slug",
	v."stripe_account_id",
	v."stripe_onboarding_complete",
	v."payment_model",
	v."email",
	v."phone",
	v."address",
	v."city",
	v."state",
	v."zip",
	v."timezone",
	v."website",
	v."logo_url",
	v."brand_color",
	v."tip_suggestions",
	v."active",
	v."created_at",
	v."updated_at"
FROM "venues" v;--> statement-breakpoint

-- ---------- 3. downstream tenant columns (tables carrying venue_id) ----------
UPDATE "tables" t
SET "location_id" = t."venue_id",
    "organization_id" = md5(t."venue_id"::text || ':org')::uuid;--> statement-breakpoint

UPDATE "checks" c
SET "location_id" = c."venue_id",
    "organization_id" = md5(c."venue_id"::text || ':org')::uuid;--> statement-breakpoint

UPDATE "integrations" i
SET "location_id" = i."venue_id",
    "organization_id" = md5(i."venue_id"::text || ':org')::uuid;--> statement-breakpoint

UPDATE "payouts" p
SET "location_id" = p."venue_id",
    "organization_id" = md5(p."venue_id"::text || ':org')::uuid;--> statement-breakpoint

-- ---------- 4. deeper tables (reach org via their parent check) ----------
UPDATE "check_items" ci
SET "organization_id" = c."organization_id"
FROM "checks" c
WHERE c."id" = ci."check_id";--> statement-breakpoint

UPDATE "claims" cl
SET "organization_id" = c."organization_id"
FROM "check_items" ci
JOIN "checks" c ON c."id" = ci."check_id"
WHERE ci."id" = cl."check_item_id";--> statement-breakpoint

UPDATE "payments" p
SET "organization_id" = c."organization_id"
FROM "checks" c
WHERE c."id" = p."check_id";--> statement-breakpoint

-- ---------- 5. users: one per distinct email (deduped across venues) ----------
-- If the same email exists at multiple venues, it collapses to ONE user with
-- multiple memberships (step 6). Prefer the row that already has a linked
-- Supabase id. is_platform_admin is left FALSE for everyone here and set
-- manually afterwards (see note at end) per the architecture doc.
INSERT INTO "users"
	("id", "supabase_user_id", "email", "name", "is_platform_admin", "active",
	 "created_at", "last_login_at")
SELECT DISTINCT ON (lower(vu."email"))
	gen_random_uuid(),
	vu."supabase_user_id",
	lower(vu."email"),
	vu."name",
	false,
	vu."active",
	vu."created_at",
	vu."last_login_at"
FROM "venue_users" vu
ORDER BY lower(vu."email"), vu."supabase_user_id" NULLS LAST, vu."created_at" ASC;--> statement-breakpoint

-- ---------- 6. memberships: one per venue_user ----------
-- owner   -> org_admin        (org-wide, location_id NULL)
-- manager -> location_manager (scoped to its location)
-- staff   -> server           (scoped to its location)
INSERT INTO "memberships"
	("id", "user_id", "organization_id", "location_id", "role", "active", "created_at")
SELECT
	gen_random_uuid(),
	u."id",
	md5(vu."venue_id"::text || ':org')::uuid,
	CASE WHEN vu."role" = 'owner' THEN NULL ELSE vu."venue_id" END,
	CASE vu."role"
		WHEN 'owner'   THEN 'org_admin'::membership_role
		WHEN 'manager' THEN 'location_manager'::membership_role
		WHEN 'staff'   THEN 'server'::membership_role
		ELSE 'server'::membership_role
	END,
	vu."active",
	vu."created_at"
FROM "venue_users" vu
JOIN "users" u ON u."email" = lower(vu."email");--> statement-breakpoint

-- ---------- 7. refunds: remap initiator venue_user -> user ----------
-- (no rows today, but keeps the column consistent for any that exist.)
UPDATE "refunds" r
SET "initiated_by_user_id_new" = u."id"
FROM "venue_users" vu
JOIN "users" u ON u."email" = lower(vu."email")
WHERE r."initiated_by_user_id" = vu."id";--> statement-breakpoint

-- ---------- 8. verification: fail loudly if anything did not backfill ----------
DO $$
DECLARE
	n_venues int; n_orgs int; n_locs int;
	bad_tables int; bad_checks int; bad_items int; bad_payments int;
	bad_integrations int; bad_payouts int;
BEGIN
	SELECT count(*) INTO n_venues FROM "venues";
	SELECT count(*) INTO n_orgs   FROM "organizations";
	SELECT count(*) INTO n_locs   FROM "locations";
	IF n_orgs <> n_venues OR n_locs <> n_venues THEN
		RAISE EXCEPTION 'Backfill count mismatch: venues=%, organizations=%, locations=%', n_venues, n_orgs, n_locs;
	END IF;

	SELECT count(*) INTO bad_tables       FROM "tables"       WHERE "location_id" IS NULL OR "organization_id" IS NULL;
	SELECT count(*) INTO bad_checks       FROM "checks"       WHERE "location_id" IS NULL OR "organization_id" IS NULL;
	SELECT count(*) INTO bad_items        FROM "check_items"  WHERE "organization_id" IS NULL;
	SELECT count(*) INTO bad_payments     FROM "payments"     WHERE "organization_id" IS NULL;
	SELECT count(*) INTO bad_integrations FROM "integrations" WHERE "location_id" IS NULL OR "organization_id" IS NULL;
	SELECT count(*) INTO bad_payouts      FROM "payouts"      WHERE "location_id" IS NULL OR "organization_id" IS NULL;

	IF bad_tables       > 0 THEN RAISE EXCEPTION '% tables missing tenant columns', bad_tables; END IF;
	IF bad_checks       > 0 THEN RAISE EXCEPTION '% checks missing tenant columns', bad_checks; END IF;
	IF bad_items        > 0 THEN RAISE EXCEPTION '% check_items missing organization_id', bad_items; END IF;
	IF bad_payments     > 0 THEN RAISE EXCEPTION '% payments missing organization_id', bad_payments; END IF;
	IF bad_integrations > 0 THEN RAISE EXCEPTION '% integrations missing tenant columns', bad_integrations; END IF;
	IF bad_payouts      > 0 THEN RAISE EXCEPTION '% payouts missing tenant columns', bad_payouts; END IF;
END $$;

-- ----------------------------------------------------------------------------
-- MANUAL STEP (run separately, NOT part of this migration):
-- Promote SplitPay team members to platform admin. Kept out of the migration
-- so no email is hardcoded (architecture anti-pattern) and so promotion is a
-- deliberate act per "Manually set to true for SplitPay team members":
--
--   UPDATE "users" SET "is_platform_admin" = true WHERE lower("email") = lower('<admin email>');
-- ----------------------------------------------------------------------------
