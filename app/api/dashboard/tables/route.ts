/**
 * API Route: List/Create Tables
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tables, venues } from "@/lib/db/schema";

// GET - List all tables
export async function GET() {
  try {
    // For now, get tables for the first venue
    const venue = await db.query.venues.findFirst();
    
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
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

// POST - Create new table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tableNumber } = body;

    if (!tableNumber) {
      return NextResponse.json(
        { error: "Missing tableNumber" },
        { status: 400 }
      );
    }

    // Get the first venue
    const venue = await db.query.venues.findFirst();
    
    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
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
    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}
