/**
 * Drizzle Kit configuration
 * Used for generating and running database migrations
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations/DDL run over DIRECT_URL (session pooler) — the transaction
    // pooler in DATABASE_URL can't hold the session state DDL needs. Falls back
    // to DATABASE_URL if DIRECT_URL isn't set.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
