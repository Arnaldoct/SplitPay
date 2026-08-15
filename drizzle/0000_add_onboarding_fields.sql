CREATE TYPE "public"."business_type" AS ENUM('sole_proprietor', 'llc', 'corporation', 'partnership', 'nonprofit', 'other');--> statement-breakpoint
CREATE TYPE "public"."check_status" AS ENUM('open', 'partially_paid', 'paid', 'voided');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."split_method" AS ENUM('full', 'even', 'by_item', 'custom');--> statement-breakpoint
CREATE TABLE "check_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_per_unit_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"claimed_cents" integer DEFAULT 0 NOT NULL,
	"pos_item_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"table_id" uuid,
	"check_number" varchar(100),
	"subtotal_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"status" "check_status" DEFAULT 'open' NOT NULL,
	"pos_check_id" varchar(255),
	"pos_metadata" jsonb,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_item_id" uuid NOT NULL,
	"guest_session_id" varchar(255) NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"provider" varchar(100) NOT NULL,
	"credentials" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"split_method" "split_method" NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_checkout_session_id" varchar(255),
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"guest_email" varchar(255),
	"guest_session_id" varchar(255),
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"transfer_method" varchar(50),
	"transfer_reference" varchar(255),
	"period_start" timestamp,
	"period_end" timestamp,
	"notes" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text,
	"stripe_refund_id" varchar(255),
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"initiated_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "refunds_stripe_refund_id_unique" UNIQUE("stripe_refund_id")
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"table_number" varchar(50) NOT NULL,
	"qr_code_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"supabase_user_id" uuid,
	"name" varchar(255),
	"role" varchar(50) DEFAULT 'staff' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"business_type" "business_type",
	"tax_id" varchar(50),
	"stripe_account_id" varchar(255),
	"stripe_onboarding_complete" boolean DEFAULT false NOT NULL,
	"payment_model" varchar(50) DEFAULT 'aggregator' NOT NULL,
	"country" varchar(2) DEFAULT 'US' NOT NULL,
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
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "check_items" ADD CONSTRAINT "check_items_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_check_item_id_check_items_id_fk" FOREIGN KEY ("check_item_id") REFERENCES "public"."check_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_user_id_venue_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."venue_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_users" ADD CONSTRAINT "venue_users_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_items_check_id_idx" ON "check_items" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "checks_venue_id_idx" ON "checks" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "checks_table_id_idx" ON "checks" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "checks_status_idx" ON "checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "claims_check_item_id_idx" ON "claims" USING btree ("check_item_id");--> statement-breakpoint
CREATE INDEX "claims_guest_session_id_idx" ON "claims" USING btree ("guest_session_id");--> statement-breakpoint
CREATE INDEX "integrations_venue_id_idx" ON "integrations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "payments_check_id_idx" ON "payments" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "payments_stripe_payment_intent_id_idx" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payouts_venue_id_idx" ON "payouts" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_payment_id_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "tables_venue_id_idx" ON "tables" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_users_venue_id_idx" ON "venue_users" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_users_email_idx" ON "venue_users" USING btree ("email");