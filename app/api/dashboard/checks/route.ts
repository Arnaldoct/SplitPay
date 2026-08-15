/**
 * API Route: Checks
 * POST — manual check entry from the dashboard
 * GET  — active checks (open / partially paid) for the staff floor view
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checks, checkItems } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getUserVenue } from "@/lib/dashboard-auth";

export async function GET() {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    const activeChecks = await db.query.checks.findMany({
      where: and(
        eq(checks.venueId, venue.id),
        inArray(checks.status, ["open", "partially_paid"])
      ),
      with: { table: true },
      orderBy: [desc(checks.openedAt)],
    });

    return NextResponse.json(activeChecks);
  } catch (error) {
    console.error("Error fetching active checks:", error);
    return NextResponse.json(
      { error: "Failed to fetch checks" },
      { status: 500 }
    );
  }
}

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
    const { tableId, checkNumber, subtotalCents, taxCents, totalCents, items } = body;

    if (!tableId || !totalCents || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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
