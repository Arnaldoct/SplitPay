/**
 * Onboarding Layout
 *
 * Ensures only authenticated users who haven't completed onboarding
 * can access this page.
 */

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createServerClient } from "@/lib/supabase/server";

export default async function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not authenticated → login
  if (!user) {
    redirect("/dashboard/login");
  }

  // Check if user has already completed onboarding
  const venueUser = await db.query.venueUsers.findFirst({
    where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
    with: { venue: true },
  });

  // If already onboarded, go to dashboard
  if (venueUser?.venue?.onboardingComplete) {
    redirect("/dashboard");
  }

  return children;
}
