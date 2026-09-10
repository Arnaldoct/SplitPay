/**
 * API Route: Stripe Express Dashboard Login Link
 *
 * Generates a one-time login URL to the venue's hosted Stripe Express
 * Dashboard, where they can see their balance, payout history, and tax
 * documents. We redirect there instead of rebuilding those views.
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireTenantContext } from "@/lib/dashboard-auth";

export async function POST() {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }
    if (!ctx.location.stripeAccountId || !ctx.location.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: "Stripe onboarding is not complete yet" },
        { status: 400 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(ctx.location.stripeAccountId);

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("Error creating Stripe login link:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe dashboard link" },
      { status: 500 }
    );
  }
}
