/**
 * API Route: Stripe Connect Express Onboarding
 *
 * POST — creates the venue's Express connected account (first call only),
 *        then returns a fresh Account Link URL for the hosted KYC flow.
 *        Stripe hosts everything; we never see bank details.
 * GET  — re-checks the account's status with Stripe and syncs our
 *        stripeOnboardingComplete flag (used when the merchant returns
 *        from the hosted flow, since webhooks may lag).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venues } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { getUserVenue } from "@/lib/dashboard-auth";

export async function POST(request: NextRequest) {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }
    if (venue.paymentModel !== "stripe_connect") {
      return NextResponse.json(
        { error: "This venue uses manual payouts — Stripe onboarding does not apply" },
        { status: 400 }
      );
    }

    let stripeAccountId = venue.stripeAccountId;

    // First time through: create the Express account
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: venue.country,
        email: venue.email ?? user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: venue.name,
          mcc: "5812", // eating places / restaurants
        },
        settings: {
          payouts: {
            schedule: { interval: "daily" },
          },
        },
      });

      stripeAccountId = account.id;

      await db
        .update(venues)
        .set({ stripeAccountId, updatedAt: new Date() })
        .where(eq(venues.id, venue.id));
    }

    // Account Links are single-use and expire — generate a fresh one each time
    const { origin } = new URL(request.url);
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/dashboard?stripe=refresh`,
      return_url: `${origin}/dashboard?stripe=return`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Error starting Stripe onboarding:", error);
    return NextResponse.json(
      { error: "Failed to start Stripe onboarding" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    if (!venue.stripeAccountId) {
      return NextResponse.json({
        paymentModel: venue.paymentModel,
        hasAccount: false,
        onboardingComplete: false,
      });
    }

    const account = await stripe.accounts.retrieve(venue.stripeAccountId);
    const isReady = Boolean(account.charges_enabled && account.payouts_enabled);

    if (isReady !== venue.stripeOnboardingComplete) {
      await db
        .update(venues)
        .set({ stripeOnboardingComplete: isReady, updatedAt: new Date() })
        .where(eq(venues.id, venue.id));
    }

    return NextResponse.json({
      paymentModel: venue.paymentModel,
      hasAccount: true,
      onboardingComplete: isReady,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error) {
    console.error("Error checking Stripe onboarding status:", error);
    return NextResponse.json(
      { error: "Failed to check Stripe status" },
      { status: 500 }
    );
  }
}
