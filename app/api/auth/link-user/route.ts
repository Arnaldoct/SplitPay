/**
 * API Route: Link Supabase User to Venue
 *
 * Called after successful auth callback to link the Supabase user ID
 * to their venueUsers record. This is needed because the onboard script
 * creates venueUsers with supabaseUserId=null.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venueUsers } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Link the Supabase user ID to the venueUsers record
    await db
      .update(venueUsers)
      .set({ supabaseUserId: user.id })
      .where(
        and(
          eq(venueUsers.email, user.email.toLowerCase()),
          isNull(venueUsers.supabaseUserId)
        )
      );

    // Check onboarding status for the venue
    const venueUser = await db.query.venueUsers.findFirst({
      where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
      with: { venue: true },
    });

    return NextResponse.json({
      success: true,
      onboardingComplete: venueUser?.venue?.onboardingComplete ?? false,
    });
  } catch (error) {
    console.error("Error linking user:", error);
    return NextResponse.json({ error: "Failed to link user" }, { status: 500 });
  }
}
