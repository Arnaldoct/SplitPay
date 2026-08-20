-- ============================================================================
-- Phase A — EXPAND (additive only, non-destructive)
-- Multi-tenancy: introduce organizations / locations / users / memberships and
-- add nullable tenant columns to downstream tables. Nothing is dropped here and
-- no existing column is altered. venues / venue_users remain fully intact.
--
-- Backfill happens in 0002_mt_backfill.sql. NOT NULL + old-column drops are
-- deferred to later "enforce" / "contract" migrations, after the app runs on
-- the new shape.
-- ============================================================================

-- ---------- Enums ----------
CREATE TYPE "public"."membership_role" AS ENUM('org_admin', 'location_manager', 'server', 'accountant');--> statement-breakpoint

-- ---------- organizations (business / brand; owns billing) ----------
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"business_type" "business_type",
	"tax_id" varchar(50),
	"country" varchar(2) DEFAULT 'US' NOT NULL,
	"billing_email" varchar(255),
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

-- ---------- locations (physical restaurant; owns Stripe / address / POS) -----
-- NOTE: in backfill, locations.id is set = venues.id (reuse), so every existing
-- venue_id value already points at the correct location. The default below only
-- applies to brand-new rows created after the migration.
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"stripe_account_id" varchar(255),
	"stripe_onboarding_complete" boolean DEFAULT false NOT NULL,
	"payment_model" varchar(50) DEFAULT 'aggregator' NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"zip" varchar(10),
	"timezone" varchar(50) DEFAULT 'America/New_York' NOT NULL,
	"website" varchar(255),
	"logo_url" text,
	"brand_color" varchar(7),
	"tip_suggestions" jsonb DEFAULT '[15,18,20,22]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

-- ---------- users (all restaurant staff + platform admins; NEVER guests) -----
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supabase_user_id" uuid,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_supabase_user_id_unique" UNIQUE("supabase_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint

-- ---------- memberships (user <-> org, with role and optional location scope) -
-- location_id NULL  => org-wide  (org_admin, accountant)
-- location_id set   => scoped to that one location (location_manager, server)
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"location_id" uuid,
	"role" "membership_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ---------- Nullable tenant columns on downstream tables ----------
-- (populated in 0002; kept nullable until a later enforce migration)
ALTER TABLE "tables" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "check_items" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "initiated_by_user_id_new" uuid;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "organization_id" uuid;--> statement-breakpoint

-- ---------- Foreign keys (new tables + new columns) ----------
-- All new columns are nullable, so these constraints hold before backfill.
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_items" ADD CONSTRAINT "check_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_user_id_new_users_id_fk" FOREIGN KEY ("initiated_by_user_id_new") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ---------- Indexes (new tables + denormalized tenant columns, for RLS) ------
CREATE INDEX "locations_organization_id_idx" ON "locations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_organization_id_idx" ON "memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_location_id_idx" ON "memberships" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "tables_location_id_idx" ON "tables" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "tables_organization_id_idx" ON "tables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "checks_location_id_idx" ON "checks" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "checks_organization_id_idx" ON "checks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "check_items_organization_id_idx" ON "check_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "claims_organization_id_idx" ON "claims" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_organization_id_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "refunds_organization_id_idx" ON "refunds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integrations_location_id_idx" ON "integrations" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "integrations_organization_id_idx" ON "integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payouts_location_id_idx" ON "payouts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "payouts_organization_id_idx" ON "payouts" USING btree ("organization_id");
