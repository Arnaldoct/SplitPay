/**
 * Dashboard auth helper
 *
 * Resolves the logged-in Supabase user to their venue_users record and venue.
 * Used by dashboard API routes to scope queries to the caller's venue.
 */

import { db } from "@/lib/db";
import { createServerClient } from "@/lib/supabase/server";

export async function getUserVenue() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { user: null, venueUser: null, venue: null };

  const venueUser = await db.query.venueUsers.findFirst({
    where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
    with: { venue: true },
  });

  return { user, venueUser: venueUser ?? null, venue: venueUser?.venue ?? null };
}
