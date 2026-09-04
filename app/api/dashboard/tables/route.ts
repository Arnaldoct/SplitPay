/**
 * API Route: List/Create Tables
 * Scoped to the logged-in user's venue
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { requireTenantContext } from "@/lib/dashboard-auth";

// GET - List all tables for the logged-in user's location (Stage C3: scope by
// location_id via the canonical tenant context instead of venue_id).
export async function GET() {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const allTables = await db.query.tables.findMany({
      where: (t, { eq }) => eq(t.locationId, ctx.location.id),
      orderBy: (t, { asc }) => [asc(t.tableNumber)],
    });

    return NextResponse.json(allTables);
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
  }
}

// POST - Create a new table for the logged-in user's location (Stage C3).
// requireTenantContext (location required) guarantees a non-null location or a
// 409, so we never stamp a null location_id.
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const body = await request.json();
    const { tableNumber } = body;

    if (!tableNumber) {
      return NextResponse.json({ error: "Missing tableNumber" }, { status: 400 });
    }

    const [newTable] = await db
      .insert(tables)
      .values({
        // Canonical tenant columns.
        locationId: ctx.location.id,
        organizationId: ctx.organization.id,
        // venue_id is still NOT NULL until the contract migration drops it.
        // Backfill invariant locations.id == venues.id, so the location id is
        // also the venue id — keeps the legacy FK satisfied and consistent.
        venueId: ctx.location.id,
        tableNumber: tableNumber.toString(),
        active: true,
      })
      .returning();

    return NextResponse.json(newTable);
  } catch (error) {
    console.error("Error creating table:", error);
    return NextResponse.json({ error: "Failed to create table" }, { status: 500 });
  }
}
