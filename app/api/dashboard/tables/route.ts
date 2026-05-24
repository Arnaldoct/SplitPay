/**
 * API Route: List/Create Tables
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";

// GET - List all tables
export async function GET() {
  try {
    // DEV MODE: Get most recent venue for testing
    // TODO: Replace with proper auth once rate limits reset
    const venue = await db.query.venues.findFirst({
      orderBy: (v, { desc }) => [desc(v.createdAt)],
    });

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

    // DEV MODE: Get most recent venue for testing
    // TODO: Replace with proper auth once rate limits reset
    const venue = await db.query.venues.findFirst({
      orderBy: (v, { desc }) => [desc(v.createdAt)],
    });
    
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
