import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venueUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();

    // Only pre-registered emails (added via onboard script) can sign in
    const existing = await db.query.venueUsers.findFirst({
      where: eq(venueUsers.email, normalized),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "This email is not registered. Contact SplitPay to get access." },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 });
  }
}
