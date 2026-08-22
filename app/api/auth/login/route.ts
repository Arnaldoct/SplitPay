import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, venueUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Validates the email is pre-registered. The client sends the OTP itself
// so PKCE works correctly (requires browser context for the code verifier).
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();

    // Gate on the canonical users table. Platform admins are a users row
    // (is_platform_admin=true), so no ADMIN_EMAIL bypass is needed.
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, normalized),
    });

    // GAP FALLBACK during Phase C: also accept a legacy venue_users match, so
    // anyone provisioned by the not-yet-migrated onboard scripts (which still
    // create only venue_users until C6) isn't locked out at the door.
    // >>> C6 MUST REMOVE this venue_users fallback once onboarding creates
    //     users rows. <<<
    const existingVenueUser = existingUser
      ? null
      : await db.query.venueUsers.findFirst({
          where: eq(venueUsers.email, normalized),
        });

    if (!existingUser && !existingVenueUser) {
      return NextResponse.json(
        { error: "This email is not registered. Contact SplitPay to get access." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
