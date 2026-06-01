import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { venueUsers } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // Create the redirect response FIRST so we can set cookies directly on it
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Set cookies on both the request and the redirect response
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              redirectResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Link Supabase user ID to the venueUsers record on first login.
      // The onboard script creates the record with supabaseUserId=null —
      // this fills it in so getUserVenue() can find the venue by user ID.
      await db
        .update(venueUsers)
        .set({ supabaseUserId: data.user.id })
        .where(
          and(
            eq(venueUsers.email, data.user.email!.toLowerCase()),
            isNull(venueUsers.supabaseUserId)
          )
        );

      return redirectResponse;
    }
  }

  // If no code or exchange failed, back to login
  return NextResponse.redirect(`${origin}/dashboard/login?error=auth_callback_failed`);
}
