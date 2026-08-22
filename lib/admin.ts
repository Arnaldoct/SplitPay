import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/dashboard-auth";

export const COMMISSION_RATE = 0.05; // 5% on food amount, not tips
// Floor so tiny transactions still cover Stripe's fixed fee portion
export const COMMISSION_MIN_CENTS = 10; // $0.10 minimum per transaction

/**
 * Gate for /admin/* server components. Backed by users.is_platform_admin
 * (replaces the old ADMIN_EMAIL env hack). Redirects unauthenticated callers to
 * login and authenticated-but-not-admin callers to the dashboard.
 */
export async function requireAdmin() {
  const { ok, ctx } = await requirePlatformAdmin();

  if (!ctx.user) redirect("/dashboard/login");
  if (!ok) redirect("/dashboard");

  return ctx.user;
}

export function calcCommission(amountCents: number) {
  if (amountCents <= 0) return 0;
  return Math.max(Math.round(amountCents * COMMISSION_RATE), COMMISSION_MIN_CENTS);
}

// Amount owed to venue = food amount − commission + tips (tips are never commissioned)
export function calcVenueOwed(amountCents: number, tipCents: number) {
  return amountCents - calcCommission(amountCents) + tipCents;
}

export function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
