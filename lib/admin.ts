import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const COMMISSION_RATE = 0.05; // 5% on food amount, not tips
// Floor so tiny transactions still cover Stripe's fixed fee portion
export const COMMISSION_MIN_CENTS = 10; // $0.10 minimum per transaction

export async function requireAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error("ADMIN_EMAIL env var is not set");

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/dashboard/login");
  if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) redirect("/dashboard");

  return user;
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
