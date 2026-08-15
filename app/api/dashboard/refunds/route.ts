/**
 * API Route: Create Refund
 *
 * Merchant-initiated refunds from the dashboard (full or partial).
 *
 * Payment-model differences:
 * - stripe_connect: the charge was a destination charge, so we must pull the
 *   money back from the restaurant's connected account (reverse_transfer) and
 *   return our platform fee too (refund_application_fee).
 * - aggregator: the charge lives on SplitPay's own account — a plain refund.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments, refunds, checks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { getUserVenue } from "@/lib/dashboard-auth";
import Stripe from "stripe";

const STRIPE_REFUND_REASONS = ["duplicate", "fraudulent", "requested_by_customer"] as const;
type StripeRefundReason = (typeof STRIPE_REFUND_REASONS)[number];

export async function POST(request: NextRequest) {
  try {
    const { user, venueUser, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!venue || !venueUser) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    const body = await request.json();
    const { paymentId, amountCents, reason } = body as {
      paymentId?: string;
      amountCents?: number;
      reason?: string;
    };

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    // Load the payment and verify it belongs to this venue
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      with: {
        check: true,
        refunds: true,
      },
    });

    if (!payment || payment.check.venueId !== venue.id) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "succeeded" && payment.status !== "partially_refunded") {
      return NextResponse.json(
        { error: "Only completed payments can be refunded" },
        { status: 400 }
      );
    }

    if (!payment.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "Payment has no Stripe payment intent to refund" },
        { status: 400 }
      );
    }

    // How much is still refundable (exclude failed refund attempts)
    const alreadyRefunded = payment.refunds
      .filter((r) => r.status !== "failed")
      .reduce((sum, r) => sum + r.amountCents, 0);
    const refundable = payment.totalCents - alreadyRefunded;

    // Default to a full refund of whatever remains
    const refundAmount = amountCents ?? refundable;

    if (!Number.isInteger(refundAmount) || refundAmount <= 0) {
      return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
    }
    if (refundAmount > refundable) {
      return NextResponse.json(
        { error: `Refund exceeds refundable amount ($${(refundable / 100).toFixed(2)})` },
        { status: 400 }
      );
    }

    const stripeReason = STRIPE_REFUND_REASONS.includes(reason as StripeRefundReason)
      ? (reason as StripeRefundReason)
      : undefined;

    // Create the refund in Stripe
    const isConnect = venue.paymentModel === "stripe_connect";
    let stripeRefund: Stripe.Refund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: refundAmount,
        ...(stripeReason ? { reason: stripeReason } : {}),
        // Destination charges: claw funds back from the restaurant's connected
        // account and return SplitPay's commission on the refunded portion.
        ...(isConnect ? { reverse_transfer: true, refund_application_fee: true } : {}),
      });
    } catch (error) {
      console.error("Stripe refund failed:", error);
      const message =
        error instanceof Stripe.errors.StripeError
          ? error.message
          : "Stripe refund failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // Record the refund
    const [refund] = await db
      .insert(refunds)
      .values({
        paymentId: payment.id,
        amountCents: refundAmount,
        reason: reason || null,
        stripeRefundId: stripeRefund.id,
        status: stripeRefund.status === "succeeded" ? "succeeded" : "pending",
        initiatedByUserId: venueUser.id,
        completedAt: stripeRefund.status === "succeeded" ? new Date() : null,
      })
      .returning();

    // Update payment status
    const totalRefunded = alreadyRefunded + refundAmount;
    const newPaymentStatus =
      totalRefunded >= payment.totalCents ? "refunded" : "partially_refunded";

    await db
      .update(payments)
      .set({ status: newPaymentStatus })
      .where(eq(payments.id, payment.id));

    // Roll the refunded amount back off the check so it reflects reality
    const check = payment.check;
    const newPaidCents = Math.max(0, check.paidCents - refundAmount);
    const newCheckStatus =
      newPaidCents === 0 ? "open" :
      newPaidCents < check.totalCents ? "partially_paid" :
      "paid";

    await db
      .update(checks)
      .set({
        paidCents: newPaidCents,
        // Full refund of the payment returns its tip as well
        ...(newPaymentStatus === "refunded"
          ? { tipCents: Math.max(0, check.tipCents - payment.tipCents) }
          : {}),
        status: newCheckStatus,
        closedAt: newCheckStatus === "paid" ? check.closedAt : null,
        updatedAt: new Date(),
      })
      .where(eq(checks.id, check.id));

    console.log(
      `💸 Refund ${refund.id} (${stripeRefund.id}) for payment ${payment.id}: ` +
      `$${(refundAmount / 100).toFixed(2)} — payment now ${newPaymentStatus}`
    );

    return NextResponse.json(refund, { status: 201 });
  } catch (error) {
    console.error("Error creating refund:", error);
    return NextResponse.json({ error: "Failed to create refund" }, { status: 500 });
  }
}
