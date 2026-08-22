/**
 * Onboarding Layout
 *
 * Ensures only authenticated users who haven't completed onboarding
 * can access this page.
 */

import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/dashboard-auth";

export default async function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organization, onboardingComplete } = await getAuthContext();

  // Not authenticated → login
  if (!user) {
    redirect("/dashboard/login");
  }

  // Already onboarded → dashboard. Mirrors the dashboard gate exactly so the
  // two can't ping-pong: dashboard redirects here only when
  // (organization && !onboardingComplete); we redirect back only when
  // (organization && onboardingComplete).
  if (organization && onboardingComplete) {
    redirect("/dashboard");
  }

  return children;
}
