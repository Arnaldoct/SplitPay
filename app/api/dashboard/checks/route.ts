/**
 * API Route: Create Check
 * Handles manual check entry from the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checks, checkItems, venues } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tableId, checkNumber, subtotalCents, taxCents, totalCents, items } = body;

    if (!tableId || !totalCents || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get venue (for now, use the first venue)
    const venue = await db.query.venues.findFirst();
    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    // Create the check
    const [check] = await db
      .insert(checks)
      .values({
        venueId: venue.id,
        tableId,
        checkNumber: checkNumber || `CHK-${Date.now()}`,
        subtotalCents,
        taxCents,
        totalCents,
        paidCents: 0,
        tipCents: 0,
        status: "open",
      })
      .returning();

    // Create check items
    for (const item of items) {
      await db.insert(checkItems).values({
        checkId: check.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnitCents: item.pricePerUnitCents,
        totalCents: item.totalCents,
        claimedCents: 0,
      });
    }

    return NextResponse.json(check);
  } catch (error) {
    console.error("Error creating check:", error);
    return NextResponse.json(
      { error: "Failed to create check" },
      { status: 500 }
    );
  }
}
