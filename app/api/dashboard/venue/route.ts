/**
 * API Route: Get/Update Venue
 * For the merchant dashboard venue management
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venues } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET - Fetch venue (for now, just get the first one)
export async function GET() {
  try {
    // In a real app, we'd get the venue based on the authenticated user
    // For now, just return the first venue
    const venue = await db.query.venues.findFirst();

    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    return NextResponse.json(venue);
  } catch (error) {
    console.error("Error fetching venue:", error);
    return NextResponse.json(
      { error: "Failed to fetch venue" },
      { status: 500 }
    );
  }
}

// PUT - Update venue
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      timezone,
      tipSuggestions,
    } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(venues)
      .set({
        name,
        email,
        phone,
        address,
        city,
        state,
        zip,
        timezone,
        tipSuggestions,
        updatedAt: new Date(),
      })
      .where(eq(venues.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating venue:", error);
    return NextResponse.json(
      { error: "Failed to update venue" },
      { status: 500 }
    );
  }
}
