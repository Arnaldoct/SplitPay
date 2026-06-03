import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venueUsers } from "@/lib/db/schema";
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

    // Admin email always allowed through
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (normalized !== adminEmail) {
      const existing = await db.query.venueUsers.findFirst({
        where: eq(venueUsers.email, normalized),
      });

      if (!existing) {
        return NextResponse.json(
          { error: "This email is not registered. Contact SplitPay to get access." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
