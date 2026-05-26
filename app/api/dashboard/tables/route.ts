/**
 * API Route: List/Create Tables
 * Scoped to the logged-in user's venue
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { createServerClient } from "@/lib/supabase/server";

// Helper — get the venue belonging to the current user
async function getUserVenue() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { user: null, venue: null };

  const venueUser = await db.query.venueUsers.findFirst({
    where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
    with: { venue: true },
  });

  return { user, venue: venueUser?.venue ?? null };
}

// GET - List all tables for the logged-in user's venue
export async function GET() {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    const allTables = await db.query.tables.findMany({
      where: (t, { eq }) => eq(t.venueId, venue.id),
      orderBy: (t, { asc }) => [asc(t.tableNumber)],
    });

    return NextResponse.json(allTables);
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
  }
}

// POST - Create new table for the logged-in user's venue
export async function POST(request: NextRequest) {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!venue) {
      return NextResponse.json({ error: "No venue found. Please set up your venue first." }, { status: 404 });
    }

    const body = await request.json();
    const { tableNumber } = body;

    if (!tableNumber) {
      return NextResponse.json({ error: "Missing tableNumber" }, { status: 400 });
    }

    const [newTable] = await db
      .insert(tables)
      .values({
        venueId: venue.id,
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
