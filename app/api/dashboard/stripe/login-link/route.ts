/**
 * API Route: Stripe Express Dashboard Login Link
 *
 * Generates a one-time login URL to the venue's hosted Stripe Express
 * Dashboard, where they can see their balance, payout history, and tax
 * documents. We redirect there instead of rebuilding those views.
 */

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getUserVenue } from "@/lib/dashboard-auth";

export async function POST() {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }
    if (!venue.stripeAccountId || !venue.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: "Stripe onboarding is not complete yet" },
        { status: 400 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(venue.stripeAccountId);

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("Error creating Stripe login link:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe dashboard link" },
      { status: 500 }
    );
  }
}
