/**
 * API Route: Complete Venue Onboarding
 *
 * Saves the venue's business details collected during the onboarding wizard.
 * Updates the existing venue record (created during initial signup).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venues, venueUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get the venue for this user
    const venueUser = await db.query.venueUsers.findFirst({
      where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
      with: { venue: true },
    });

    if (!venueUser?.venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "name",
      "legalName",
      "businessType",
      "taxId",
      "country",
      "address",
      "city",
      "state",
      "zip",
      "phone",
      "timezone",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Update venue with onboarding data
    await db
      .update(venues)
      .set({
        name: body.name,
        legalName: body.legalName,
        businessType: body.businessType,
        taxId: body.taxId,
        country: body.country,
        address: body.address,
        city: body.city,
        state: body.state,
        zip: body.zip,
        phone: body.phone,
        timezone: body.timezone,
        website: body.website || null,
        logoUrl: body.logoUrl || null,
        brandColor: body.brandColor || null,
        onboardingComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(venues.id, venueUser.venue.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to save onboarding data" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get the venue for this user
    const venueUser = await db.query.venueUsers.findFirst({
      where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
      with: { venue: true },
    });

    if (!venueUser?.venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    // Return current venue data for pre-filling the form
    return NextResponse.json({
      venue: {
        name: venueUser.venue.name,
        legalName: venueUser.venue.legalName,
        businessType: venueUser.venue.businessType,
        taxId: venueUser.venue.taxId,
        country: venueUser.venue.country,
        address: venueUser.venue.address,
        city: venueUser.venue.city,
        state: venueUser.venue.state,
        zip: venueUser.venue.zip,
        phone: venueUser.venue.phone,
        timezone: venueUser.venue.timezone,
        website: venueUser.venue.website,
        logoUrl: venueUser.venue.logoUrl,
        brandColor: venueUser.venue.brandColor,
        onboardingComplete: venueUser.venue.onboardingComplete,
      },
    });
  } catch (error) {
    console.error("Get onboarding data error:", error);
    return NextResponse.json(
      { error: "Failed to get onboarding data" },
      { status: 500 }
    );
  }
}
