/**
 * API Route: Get/Create/Update Venue
 * Scoped to the logged-in user's venue via venueUsers table
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venues, venueUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";
import { getDefaultPaymentModel } from "@/lib/payments/factory";

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

// GET - Fetch venue for the logged-in user
export async function GET() {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    return NextResponse.json(venue);
  } catch (error) {
    console.error("Error fetching venue:", error);
    return NextResponse.json({ error: "Failed to fetch venue" }, { status: 500 });
  }
}

// POST - Create a new venue for the logged-in user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, country = "US" } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
    }

    // Generate a unique slug from the name
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${base}-${Date.now()}`;

    // Auto-set payment model based on country
    const paymentModel = getDefaultPaymentModel(country);

    // Create the venue
    const [venue] = await db.insert(venues).values({
      name: name.trim(),
      slug,
      email: user.email,
      country: country.toUpperCase(),
      paymentModel,
    }).returning();

    // Link the user to the venue as owner
    await db.insert(venueUsers).values({
      venueId: venue.id,
      email: user.email!,
      supabaseUserId: user.id,
      role: "owner",
    });

    return NextResponse.json(venue, { status: 201 });
  } catch (error) {
    console.error("Error creating venue:", error);
    return NextResponse.json({ error: "Failed to create venue" }, { status: 500 });
  }
}

// PUT - Update existing venue
export async function PUT(request: NextRequest) {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, phone, address, city, state, zip, timezone, tipSuggestions, country } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [updated] = await db
      .update(venues)
      .set({
        name, email, phone, address, city, state, zip, timezone, tipSuggestions,
        ...(country ? { country: country.toUpperCase(), paymentModel: getDefaultPaymentModel(country) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(venues.id, venue.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating venue:", error);
    return NextResponse.json({ error: "Failed to update venue" }, { status: 500 });
  }
}
