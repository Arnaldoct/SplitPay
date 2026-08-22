/**
 * Dashboard Layout
 *
 * Wraps all dashboard pages. Checks if the user has completed onboarding
 * and redirects to /onboard if not.
 */

import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/dashboard-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organization, onboardingComplete } = await getAuthContext();

  // Not authenticated → middleware handles the redirect to login.
  if (!user) {
    return children;
  }

  // Only redirect when there is a resolved organization that is genuinely
  // un-onboarded. Users with no users row / no membership (e.g. platform
  // admins) fall through and render — the API routes 404 rather than looping.
  if (organization && !onboardingComplete) {
    redirect("/onboard");
  }

  return children;
}
