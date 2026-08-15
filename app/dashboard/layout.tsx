/**
 * Dashboard Layout
 *
 * Wraps all dashboard pages. Checks if the user has completed onboarding
 * and redirects to /onboard if not.
 */

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If not authenticated, middleware handles redirect to login
  if (!user) {
    return children;
  }

  // Check if user has completed onboarding
  const venueUser = await db.query.venueUsers.findFirst({
    where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
    with: { venue: true },
  });

  // If user has a venue that hasn't completed onboarding, redirect
  if (venueUser?.venue && !venueUser.venue.onboardingComplete) {
    redirect("/onboard");
  }

  return children;
}
