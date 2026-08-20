-- ============================================================================
-- _baseline_bootstrap.sql  —  ONE-TIME MANUAL BOOTSTRAP (NOT a drizzle migration)
-- ============================================================================
-- Run this ONCE, by hand, against the target database BEFORE the first
-- `npm run db:migrate` of the new sequence. It is intentionally NOT listed in
-- meta/_journal.json, so drizzle never runs it automatically.
--
-- WHY THIS EXISTS
-- The live DB was created by an old `db:push`, so it already contains every
-- object that migration 0000 would create (all tables, enums, indexes) — but
-- drizzle's bookkeeping table `drizzle.__drizzle_migrations` is EMPTY. If you
-- run `db:migrate` in that state, drizzle thinks NOTHING has been applied and
-- tries to run 0000 from scratch, colliding with the already-existing objects.
--
-- WHAT THIS DOES
-- Marks 0000 as already-applied by inserting its file hash + journal timestamp.
-- After this, `db:migrate` sees "last applied = 0000" and cleanly proceeds to
-- 0001_reconcile_baseline -> 0002_mt_expand -> 0003_mt_backfill.
--
--   hash       = sha256 of drizzle/0000_add_onboarding_fields.sql
--                (d2d8b592324e50cdca6806de89837d004407ebd77460030e798f80e5c5e54558)
--   created_at = 0000's "when" from meta/_journal.json (1786833823446)
--
-- Idempotent: the WHERE NOT EXISTS guard makes re-running a no-op.
-- ============================================================================

INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT
	'd2d8b592324e50cdca6806de89837d004407ebd77460030e798f80e5c5e54558',
	1786833823446
WHERE NOT EXISTS (
	SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = 1786833823446
);
