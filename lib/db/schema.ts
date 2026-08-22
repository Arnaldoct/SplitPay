/**
 * Database schema definitions
 * 
 * All monetary amounts stored as integers in cents (USD only for v1)
 * All timestamps stored in UTC
 * UUIDs used for primary keys to avoid enumeration attacks
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const checkStatusEnum = pgEnum("check_status", [
  "open",
  "partially_paid",
  "paid",
  "voided",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const splitMethodEnum = pgEnum("split_method", [
  "full",
  "even",
  "by_item",
  "custom",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "succeeded",
  "failed",
]);

export const businessTypeEnum = pgEnum("business_type", [
  "sole_proprietor",
  "llc",
  "corporation",
  "partnership",
  "nonprofit",
  "other",
]);

export const membershipRoleEnum = pgEnum("membership_role", [
  "org_admin",
  "location_manager",
  "server",
  "accountant",
]);

// ============================================================================
// ORGANIZATIONS (canonical: business / brand — owns billing)
// ============================================================================
// Multi-tenant canonical tables. These are the source of truth going forward;
// the legacy venues / venue_users tables below are kept only until the contract
// migration drops them. See docs/ARCHITECTURE.md "Multi-tenancy hierarchy".

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),

  // Legal / Tax info (org-level for billing & compliance)
  legalName: varchar("legal_name", { length: 255 }),
  businessType: businessTypeEnum("business_type"),
  taxId: varchar("tax_id", { length: 50 }),

  // ISO 3166-1 alpha-2 country code (HN, GT, US, MX, etc.)
  country: varchar("country", { length: 2 }).default("US").notNull(),

  // SplitPay commission invoicing is at the organization level
  billingEmail: varchar("billing_email", { length: 255 }),

  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// LOCATIONS (canonical: physical restaurant — owns Stripe / address / POS)
// ============================================================================
// NOTE: backfill set locations.id = venues.id, so every existing venue_id value
// already identifies the correct location.

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),

  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),

  // Stripe Connect account attaches at the location level, never organization
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false).notNull(),

  // Payment model — drives which payment adapter is used
  // 'aggregator'     : SplitPay collects funds, pays restaurant manually
  // 'stripe_connect' : Restaurant has own Stripe account, gets paid directly
  paymentModel: varchar("payment_model", { length: 50 }).default("aggregator").notNull(),

  // Contact & address
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  zip: varchar("zip", { length: 10 }),
  timezone: varchar("timezone", { length: 50 }).default("America/New_York").notNull(),
  website: varchar("website", { length: 255 }),

  // Branding
  logoUrl: text("logo_url"),
  brandColor: varchar("brand_color", { length: 7 }),

  // Business settings
  tipSuggestions: jsonb("tip_suggestions").$type<number[]>().default([15, 18, 20, 22]).notNull(),

  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index("locations_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// USERS (canonical: all restaurant staff + platform admins; NEVER guests)
// ============================================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  supabaseUserId: uuid("supabase_user_id").unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),

  // Manually set true for SplitPay team members; gates /admin access
  isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),

  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

// ============================================================================
// MEMBERSHIPS (user <-> organization, with role and optional location scope)
// ============================================================================
// location_id NULL => org-wide  (org_admin, accountant)
// location_id set  => scoped to that one location (location_manager, server)

export const memberships = pgTable("memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  locationId: uuid("location_id").references(() => locations.id),
  role: membershipRoleEnum("role").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("memberships_user_id_idx").on(table.userId),
  organizationIdIdx: index("memberships_organization_id_idx").on(table.organizationId),
  locationIdIdx: index("memberships_location_id_idx").on(table.locationId),
}));

// ============================================================================
// VENUES (LEGACY — kept until the contract migration drops it)
// ============================================================================

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  
  // Legal / Tax info (for receipts & compliance)
  legalName: varchar("legal_name", { length: 255 }),
  businessType: businessTypeEnum("business_type"),
  taxId: varchar("tax_id", { length: 50 }), // EIN (US), TIN, RTN (Honduras), etc.
  
  // Stripe Connect account ID for this venue
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false).notNull(),

  // Payment model — drives which payment adapter is used
  // 'aggregator'    : SplitPay collects funds, pays restaurant manually (Honduras, Guatemala, etc.)
  // 'stripe_connect': Restaurant has own Stripe account, gets paid directly (US, Mexico, etc.)
  paymentModel: varchar("payment_model", { length: 50 }).default("aggregator").notNull(),

  // ISO 3166-1 alpha-2 country code (HN, GT, US, MX, etc.)
  country: varchar("country", { length: 2 }).default("US").notNull(),

  // Contact & location
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  zip: varchar("zip", { length: 10 }),
  timezone: varchar("timezone", { length: 50 }).default("America/New_York").notNull(),
  website: varchar("website", { length: 255 }),

  // Branding
  logoUrl: text("logo_url"),
  brandColor: varchar("brand_color", { length: 7 }), // Hex color e.g. #6B21A8

  // Business settings
  tipSuggestions: jsonb("tip_suggestions").$type<number[]>().default([15, 18, 20, 22]).notNull(),

  // Onboarding tracking
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),

  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// VENUE USERS (LEGACY — Merchant Dashboard Access; superseded by users/memberships)
// ============================================================================

export const venueUsers = pgTable("venue_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").references(() => venues.id).notNull(),
  
  // Auth via Supabase magic link
  email: varchar("email", { length: 255 }).notNull(),
  supabaseUserId: uuid("supabase_user_id"),
  
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 50 }).default("staff").notNull(), // staff, manager, owner
  
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
}, (table) => ({
  venueIdIdx: index("venue_users_venue_id_idx").on(table.venueId),
  emailIdx: index("venue_users_email_idx").on(table.email),
}));

// ============================================================================
// TABLES (Physical tables at the venue)
// ============================================================================

export const tables = pgTable("tables", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").references(() => venues.id).notNull(),

  // Canonical tenant columns (nullable until the enforce migration)
  locationId: uuid("location_id").references(() => locations.id),
  organizationId: uuid("organization_id").references(() => organizations.id),

  tableNumber: varchar("table_number", { length: 50 }).notNull(),
  qrCodeUrl: text("qr_code_url"),

  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  venueIdIdx: index("tables_venue_id_idx").on(table.venueId),
  locationIdIdx: index("tables_location_id_idx").on(table.locationId),
  organizationIdIdx: index("tables_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// CHECKS (Open bills at tables)
// ============================================================================

export const checks = pgTable("checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").references(() => venues.id).notNull(),
  tableId: uuid("table_id").references(() => tables.id),

  // Canonical tenant columns (nullable until the enforce migration)
  locationId: uuid("location_id").references(() => locations.id),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Check details
  checkNumber: varchar("check_number", { length: 100 }),
  subtotalCents: integer("subtotal_cents").notNull(), // Before tax/tip
  taxCents: integer("tax_cents").default(0).notNull(),
  totalCents: integer("total_cents").notNull(), // Subtotal + tax
  
  // Payment tracking
  paidCents: integer("paid_cents").default(0).notNull(),
  tipCents: integer("tip_cents").default(0).notNull(),
  
  status: checkStatusEnum("status").default("open").notNull(),
  
  // POS integration metadata
  posCheckId: varchar("pos_check_id", { length: 255 }), // External POS system check ID
  posMetadata: jsonb("pos_metadata"),
  
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  venueIdIdx: index("checks_venue_id_idx").on(table.venueId),
  tableIdIdx: index("checks_table_id_idx").on(table.tableId),
  statusIdx: index("checks_status_idx").on(table.status),
  locationIdIdx: index("checks_location_id_idx").on(table.locationId),
  organizationIdIdx: index("checks_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// CHECK ITEMS (Line items on a check)
// ============================================================================

export const checkItems = pgTable("check_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkId: uuid("check_id").references(() => checks.id).notNull(),

  // Canonical tenant column (nullable until the enforce migration)
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: varchar("name", { length: 255 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  pricePerUnitCents: integer("price_per_unit_cents").notNull(),
  totalCents: integer("total_cents").notNull(), // quantity * pricePerUnit
  
  // For split-by-item tracking
  claimedCents: integer("claimed_cents").default(0).notNull(),
  
  // POS integration
  posItemId: varchar("pos_item_id", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  checkIdIdx: index("check_items_check_id_idx").on(table.checkId),
  organizationIdIdx: index("check_items_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// CLAIMS (Guest claims on check items for split-by-item)
// ============================================================================

export const claims = pgTable("claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkItemId: uuid("check_item_id").references(() => checkItems.id).notNull(),

  // Canonical tenant column (nullable until the enforce migration)
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Guest identifier (ephemeral, no account)
  guestSessionId: varchar("guest_session_id", { length: 255 }).notNull(),
  
  amountCents: integer("amount_cents").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  checkItemIdIdx: index("claims_check_item_id_idx").on(table.checkItemId),
  guestSessionIdIdx: index("claims_guest_session_id_idx").on(table.guestSessionId),
  organizationIdIdx: index("claims_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// PAYMENTS (Completed transactions via Stripe)
// ============================================================================

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkId: uuid("check_id").references(() => checks.id).notNull(),

  // Canonical tenant column (nullable until the enforce migration)
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Payment details
  amountCents: integer("amount_cents").notNull(),
  tipCents: integer("tip_cents").default(0).notNull(),
  totalCents: integer("total_cents").notNull(), // amount + tip
  
  splitMethod: splitMethodEnum("split_method").notNull(),
  
  // Stripe
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }).unique(),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  status: paymentStatusEnum("status").default("pending").notNull(),
  
  // Guest info (optional, for receipt)
  guestEmail: varchar("guest_email", { length: 255 }),
  guestSessionId: varchar("guest_session_id", { length: 255 }),
  
  // Error tracking
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  checkIdIdx: index("payments_check_id_idx").on(table.checkId),
  stripePaymentIntentIdIdx: index("payments_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
  statusIdx: index("payments_status_idx").on(table.status),
  organizationIdIdx: index("payments_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// REFUNDS
// ============================================================================

export const refunds = pgTable("refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id).notNull(),

  // Canonical tenant column (nullable until the enforce migration)
  organizationId: uuid("organization_id").references(() => organizations.id),

  amountCents: integer("amount_cents").notNull(),
  reason: text("reason"),

  // Stripe
  stripeRefundId: varchar("stripe_refund_id", { length: 255 }).unique(),
  status: refundStatusEnum("status").default("pending").notNull(),

  // Initiated by (LEGACY column → venue_users; superseded by initiatedByUserIdNew)
  initiatedByUserId: uuid("initiated_by_user_id").references(() => venueUsers.id),
  // Canonical initiator → users. The contract phase renames this to
  // initiated_by_user_id once the legacy column is dropped.
  initiatedByUserIdNew: uuid("initiated_by_user_id_new").references(() => users.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  paymentIdIdx: index("refunds_payment_id_idx").on(table.paymentId),
  organizationIdIdx: index("refunds_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// PAYOUTS (Aggregator model — tracks manual payouts to venues)
// ============================================================================

export const payouts = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").references(() => venues.id).notNull(),

  // Canonical tenant columns (nullable until the enforce migration).
  // Manual payouts attach to organization_id (billing); location_id is kept
  // for reference.
  locationId: uuid("location_id").references(() => locations.id),
  organizationId: uuid("organization_id").references(() => organizations.id),

  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),

  // pending → processing → completed | failed
  status: varchar("status", { length: 50 }).default("pending").notNull(),

  // How the payout was sent (wise, bank_transfer, cash, etc.)
  transferMethod: varchar("transfer_method", { length: 50 }),
  transferReference: varchar("transfer_reference", { length: 255 }),

  // The period this payout covers
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),

  notes: text("notes"),

  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  venueIdIdx: index("payouts_venue_id_idx").on(table.venueId),
  statusIdx: index("payouts_status_idx").on(table.status),
  locationIdIdx: index("payouts_location_id_idx").on(table.locationId),
  organizationIdIdx: index("payouts_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// INTEGRATIONS (POS system configs per venue)
// ============================================================================

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").references(() => venues.id).notNull(),

  // Canonical tenant columns (nullable until the enforce migration)
  locationId: uuid("location_id").references(() => locations.id),
  organizationId: uuid("organization_id").references(() => organizations.id),

  provider: varchar("provider", { length: 100 }).notNull(), // 'manual', 'square', 'clover', 'toast', etc.
  
  // Encrypted credentials (will use Supabase Vault or similar)
  credentials: jsonb("credentials"), // API keys, tokens, etc.
  
  active: boolean("active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  venueIdIdx: index("integrations_venue_id_idx").on(table.venueId),
  locationIdIdx: index("integrations_location_id_idx").on(table.locationId),
  organizationIdIdx: index("integrations_organization_id_idx").on(table.organizationId),
}));

// ============================================================================
// RELATIONS (for Drizzle query API)
// ============================================================================

// ---- Canonical multi-tenant relations ----

export const organizationsRelations = relations(organizations, ({ many }) => ({
  locations: many(locations),
  memberships: many(memberships),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [locations.organizationId],
    references: [organizations.id],
  }),
  memberships: many(memberships),
  tables: many(tables),
  checks: many(checks),
  integrations: many(integrations),
  payouts: many(payouts),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [memberships.locationId],
    references: [locations.id],
  }),
}));

// ---- Legacy + downstream relations ----

export const venuesRelations = relations(venues, ({ many }) => ({
  venueUsers: many(venueUsers),
  tables: many(tables),
  checks: many(checks),
  integrations: many(integrations),
  payouts: many(payouts),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  venue: one(venues, {
    fields: [payouts.venueId],
    references: [venues.id],
  }),
  location: one(locations, {
    fields: [payouts.locationId],
    references: [locations.id],
  }),
  organization: one(organizations, {
    fields: [payouts.organizationId],
    references: [organizations.id],
  }),
}));

export const venueUsersRelations = relations(venueUsers, ({ one }) => ({
  venue: one(venues, {
    fields: [venueUsers.venueId],
    references: [venues.id],
  }),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  venue: one(venues, {
    fields: [tables.venueId],
    references: [venues.id],
  }),
  location: one(locations, {
    fields: [tables.locationId],
    references: [locations.id],
  }),
  organization: one(organizations, {
    fields: [tables.organizationId],
    references: [organizations.id],
  }),
  checks: many(checks),
}));

export const checksRelations = relations(checks, ({ one, many }) => ({
  venue: one(venues, {
    fields: [checks.venueId],
    references: [venues.id],
  }),
  location: one(locations, {
    fields: [checks.locationId],
    references: [locations.id],
  }),
  organization: one(organizations, {
    fields: [checks.organizationId],
    references: [organizations.id],
  }),
  table: one(tables, {
    fields: [checks.tableId],
    references: [tables.id],
  }),
  checkItems: many(checkItems),
  payments: many(payments),
}));

export const checkItemsRelations = relations(checkItems, ({ one, many }) => ({
  check: one(checks, {
    fields: [checkItems.checkId],
    references: [checks.id],
  }),
  organization: one(organizations, {
    fields: [checkItems.organizationId],
    references: [organizations.id],
  }),
  claims: many(claims),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  checkItem: one(checkItems, {
    fields: [claims.checkItemId],
    references: [checkItems.id],
  }),
  organization: one(organizations, {
    fields: [claims.organizationId],
    references: [organizations.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  check: one(checks, {
    fields: [payments.checkId],
    references: [checks.id],
  }),
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  refunds: many(refunds),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, {
    fields: [refunds.paymentId],
    references: [payments.id],
  }),
  organization: one(organizations, {
    fields: [refunds.organizationId],
    references: [organizations.id],
  }),
  // Legacy initiator → venue_users
  initiatedBy: one(venueUsers, {
    fields: [refunds.initiatedByUserId],
    references: [venueUsers.id],
  }),
  // Canonical initiator → users
  initiatedByUser: one(users, {
    fields: [refunds.initiatedByUserIdNew],
    references: [users.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  venue: one(venues, {
    fields: [integrations.venueId],
    references: [venues.id],
  }),
  location: one(locations, {
    fields: [integrations.locationId],
    references: [locations.id],
  }),
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
}));
