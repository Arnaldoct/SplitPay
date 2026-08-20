-- ============================================================================
-- 0001 — RECONCILE / BASELINE SYNC
-- ============================================================================
-- Brings the live database into agreement with schema.ts (and the full 0000
-- baseline). The DB was originally built by an old `db:push` from a
-- pre-onboarding schema, so it is missing the onboarding delta and carries two
-- orphaned columns. This migration closes that gap:
--
--   * creates the missing "business_type" enum type
--   * adds the 6 missing venues columns (exact types/defaults from 0000)
--   * drops the orphaned venues.latitude / venues.longitude (zero code refs)
--
-- IMPORTANT ordering note: this migration assumes 0000 has been marked as
-- already-applied in drizzle.__drizzle_migrations (see _baseline_bootstrap.sql).
-- All statements use IF [NOT] EXISTS guards, so this is idempotent and safe to
-- run even if some of these objects happen to already exist.
-- ============================================================================

-- ---- business_type enum (present in 0000 / schema.ts, missing in the DB) ----
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE t.typname = 'business_type' AND n.nspname = 'public'
	) THEN
		CREATE TYPE "public"."business_type" AS ENUM('sole_proprietor', 'llc', 'corporation', 'partnership', 'nonprofit', 'other');
	END IF;
END $$;--> statement-breakpoint

-- ---- 6 missing onboarding columns (types/defaults exactly per 0000) ----
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "legal_name" varchar(255);--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "business_type" "business_type";--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "tax_id" varchar(50);--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "website" varchar(255);--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "brand_color" varchar(7);--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "onboarding_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- ---- Drop orphaned columns (not in schema.ts, zero references in app/lib/scripts) ----
ALTER TABLE "venues" DROP COLUMN IF EXISTS "latitude";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "longitude";
