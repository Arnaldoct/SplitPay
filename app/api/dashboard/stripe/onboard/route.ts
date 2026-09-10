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
import { venues, locations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { requireTenantContext } from "@/lib/dashboard-auth";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }
    if (ctx.location.paymentModel !== "stripe_connect") {
      return NextResponse.json(
        { error: "This location uses manual payouts — Stripe onboarding does not apply" },
        { status: 400 }
      );
    }

    let stripeAccountId = ctx.location.stripeAccountId;

    // Defense-in-depth for the expand phase: if the location row wasn't
    // backfilled but the legacy venue row already holds a connected account
    // (locations.id == venues.id), reuse it rather than creating a duplicate
    // Stripe account. Persist it onto the location so future reads are canonical.
    if (!stripeAccountId) {
      const legacyVenue = await db.query.venues.findFirst({
        where: eq(venues.id, ctx.location.id),
      });
      if (legacyVenue?.stripeAccountId) {
        stripeAccountId = legacyVenue.stripeAccountId;
        await db
          .update(locations)
          .set({ stripeAccountId, updatedAt: new Date() })
          .where(eq(locations.id, ctx.location.id));
      }
    }

    // First time through: create the Express account
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: ctx.organization.country,
        email: ctx.organization.billingEmail ?? ctx.dbUser.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: ctx.location.name,
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
        .update(locations)
        .set({ stripeAccountId, updatedAt: new Date() })
        .where(eq(locations.id, ctx.location.id));
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
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    if (!ctx.location.stripeAccountId) {
      return NextResponse.json({
        paymentModel: ctx.location.paymentModel,
        hasAccount: false,
        onboardingComplete: false,
      });
    }

    const account = await stripe.accounts.retrieve(ctx.location.stripeAccountId);
    const isReady = Boolean(account.charges_enabled && account.payouts_enabled);

    if (isReady !== ctx.location.stripeOnboardingComplete) {
      await db
        .update(locations)
        .set({ stripeOnboardingComplete: isReady, updatedAt: new Date() })
        .where(eq(locations.id, ctx.location.id));
    }

    return NextResponse.json({
      paymentModel: ctx.location.paymentModel,
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
