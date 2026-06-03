import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const COMMISSION_RATE = 0.05; // 5% on food amount, not tips

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
  return Math.round(amountCents * COMMISSION_RATE);
}

// Amount owed to venue = (food amount × 0.95) + tips
export function calcVenueOwed(amountCents: number, tipCents: number) {
  return Math.round(amountCents * (1 - COMMISSION_RATE)) + tipCents;
}

export function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
