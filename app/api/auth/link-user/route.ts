/**
 * API Route: Link Supabase User
 *
 * Called after a successful auth callback to attach the Supabase user id onto
 * the caller's row(s). Onboard scripts create rows with supabaseUserId=null, so
 * this fills it in on first login.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, venueUsers } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/dashboard-auth";

export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const email = user.email.toLowerCase();

    // Link the canonical users row.
    await db
      .update(users)
      .set({ supabaseUserId: user.id })
      .where(and(eq(users.email, email), isNull(users.supabaseUserId)));

    // DUAL-WRITE during the Phase C gap: also link the legacy venue_users row.
    // The not-yet-migrated routes still resolve tenant via getUserVenue ->
    // venue_users, so a brand-new first-login would 404 there without this.
    // >>> C6 MUST REMOVE this venue_users write once the legacy path is gone. <<<
    await db
      .update(venueUsers)
      .set({ supabaseUserId: user.id })
      .where(and(eq(venueUsers.email, email), isNull(venueUsers.supabaseUserId)));

    // Resolve onboarding status via the canonical context (reads the row we
    // just linked). Used by the callback to route to /onboard vs /dashboard.
    const { onboardingComplete } = await getAuthContext();

    return NextResponse.json({ success: true, onboardingComplete });
  } catch (error) {
    console.error("Error linking user:", error);
    return NextResponse.json({ error: "Failed to link user" }, { status: 500 });
  }
}
