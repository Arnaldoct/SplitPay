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

// ============================================================================
// VENUES
// ============================================================================

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  
  // Stripe Connect account ID for this venue
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false).notNull(),
  
  // Contact & location
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zip: varchar("zip", { length: 10 }),
  timezone: varchar("timezone", { length: 50 }).default("America/New_York").notNull(),
  
  // Business settings
  tipSuggestions: jsonb("tip_suggestions").$type<number[]>().default([15, 18, 20, 22]).notNull(),
  
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// VENUE USERS (Merchant Dashboard Access)
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
  
  tableNumber: varchar("table_number", { length: 50 }).notNull(),
  qrCodeUrl: text("qr_code_url"),
  
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  venueIdIdx: index("tables_venue_id_idx").on(table.venueId),
}));

// ============================================================================
// CHECKS (Open bills at tables)
// ============================================================================

export const checks = pgTable("checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").references(() => venues.id).notNull(),
  tableId: uuid("table_id").references(() => tables.id),
  
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
}));

// ============================================================================
// CHECK ITEMS (Line items on a check)
// ============================================================================

export const checkItems = pgTable("check_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkId: uuid("check_id").references(() => checks.id).notNull(),
  
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
}));

// ============================================================================
// CLAIMS (Guest claims on check items for split-by-item)
// ============================================================================

export const claims = pgTable("claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkItemId: uuid("check_item_id").references(() => checkItems.id).notNull(),
  
  // Guest identifier (ephemeral, no account)
  guestSessionId: varchar("guest_session_id", { length: 255 }).notNull(),
  
  amountCents: integer("amount_cents").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  checkItemIdIdx: index("claims_check_item_id_idx").on(table.checkItemId),
  guestSessionIdIdx: index("claims_guest_session_id_idx").on(table.guestSessionId),
}));

// ============================================================================
// PAYMENTS (Completed transactions via Stripe)
// ============================================================================

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkId: uuid("check_id").references(() => checks.id).notNull(),
  
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
}));

// ============================================================================
// REFUNDS
// ============================================================================

export const refunds = pgTable("refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id).notNull(),
  
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason"),
  
  // Stripe
  stripeRefundId: varchar("stripe_refund_id", { length: 255 }).unique(),
  status: refundStatusEnum("status").default("pending").notNull(),
  
  // Initiated by
  initiatedByUserId: uuid("initiated_by_user_id").references(() => venueUsers.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  paymentIdIdx: index("refunds_payment_id_idx").on(table.paymentId),
}));

// ============================================================================
// INTEGRATIONS (POS system configs per venue)
// ============================================================================

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").references(() => venues.id).notNull(),
  
  provider: varchar("provider", { length: 100 }).notNull(), // 'manual', 'square', 'clover', 'toast', etc.
  
  // Encrypted credentials (will use Supabase Vault or similar)
  credentials: jsonb("credentials"), // API keys, tokens, etc.
  
  active: boolean("active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  venueIdIdx: index("integrations_venue_id_idx").on(table.venueId),
}));

// ============================================================================
// RELATIONS (for Drizzle query API)
// ============================================================================

export const venuesRelations = relations(venues, ({ many }) => ({
  venueUsers: many(venueUsers),
  tables: many(tables),
  checks: many(checks),
  integrations: many(integrations),
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
  checks: many(checks),
}));

export const checksRelations = relations(checks, ({ one, many }) => ({
  venue: one(venues, {
    fields: [checks.venueId],
    references: [venues.id],
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
  claims: many(claims),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  checkItem: one(checkItems, {
    fields: [claims.checkItemId],
    references: [checkItems.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  check: one(checks, {
    fields: [payments.checkId],
    references: [checks.id],
  }),
  refunds: many(refunds),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, {
    fields: [refunds.paymentId],
    references: [payments.id],
  }),
  initiatedBy: one(venueUsers, {
    fields: [refunds.initiatedByUserId],
    references: [venueUsers.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  venue: one(venues, {
    fields: [integrations.venueId],
    references: [venues.id],
  }),
}));
