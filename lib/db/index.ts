/**
 * Drizzle database client
 * This file initializes the connection to our Postgres database via Supabase
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create postgres connection.
//
// DATABASE_URL points at Supabase's TRANSACTION pooler (PgBouncer, port 6543),
// which multiplexes connections for serverless-style Next.js. Transaction mode
// does NOT support prepared statements, so `prepare: false` is REQUIRED here —
// without it you get "prepared statement already exists" errors under load.
// Migrations use DIRECT_URL (session pooler) instead; see drizzle.config.ts.
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString, { prepare: false });

// Create drizzle instance with our schema
export const db = drizzle(client, { schema });
