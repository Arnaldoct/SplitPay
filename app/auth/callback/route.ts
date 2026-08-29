import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, venueUsers } from "@/lib/db/schema";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/dashboard-auth";

/**
 * Server-side auth callback — canonical @supabase/ssr App Router pattern.
 *
 * Replaces the old client-component callback whose exchangeCodeForSession() ran
 * inside a useEffect. React Strict Mode fired that effect twice in dev; the
 * first call consumed the one-time PKCE verifier cookie and the second threw
 * "PKCE code verifier not found in storage". A Route Handler runs exactly once
 * and sets the session cookies server-side.
 *
 * Inlines the former /api/auth/link-user behavior (C2): the supabase_user_id
 * dual-write to users + venue_users, and the getAuthContext() onboarding check.
 * >>> /api/auth/link-user is now unused and can be removed in a later cleanup. <<<
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  const loginWithError = (msg: string) =>
    NextResponse.redirect(`${origin}/dashboard/login?error=${encodeURIComponent(msg)}`);

  // Supabase bounced back an error (e.g. expired/invalid link).
  if (errorDescription) return loginWithError(errorDescription);
  if (!code) return loginWithError("Missing authentication code");

  const supabase = await createServerClient();

  // Exchange the code for a session. Server-side: reads the PKCE verifier from
  // the cookie set at send-time and writes the session cookies onto this
  // response (Route Handlers can mutate cookies()).
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    return loginWithError(error?.message ?? "Authentication failed");
  }

  const email = data.user.email.toLowerCase();

  // --- Preserve /api/auth/link-user behavior (C2) --------------------------
  // Link the canonical users row (fills supabase_user_id on first login).
  await db
    .update(users)
    .set({ supabaseUserId: data.user.id })
    .where(and(eq(users.email, email), isNull(users.supabaseUserId)));

  // DUAL-WRITE during the Phase C gap: also link the legacy venue_users row so
  // the not-yet-migrated getUserVenue() routes resolve on first login.
  // >>> C6 MUST REMOVE this venue_users write once the legacy path is gone. <<<
  await db
    .update(venueUsers)
    .set({ supabaseUserId: data.user.id })
    .where(and(eq(venueUsers.email, email), isNull(venueUsers.supabaseUserId)));

  // Resolve onboarding status via the canonical context (reads the row we just
  // linked and the session cookie set above), exactly as link-user did.
  const { onboardingComplete } = await getAuthContext();

  return NextResponse.redirect(`${origin}${onboardingComplete ? "/dashboard" : "/onboard"}`);
}
