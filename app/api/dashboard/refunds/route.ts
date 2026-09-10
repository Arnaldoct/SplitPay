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
import { requireTenantContext } from "@/lib/dashboard-auth";
import Stripe from "stripe";

const STRIPE_REFUND_REASONS = ["duplicate", "fraudulent", "requested_by_customer"] as const;
type StripeRefundReason = (typeof STRIPE_REFUND_REASONS)[number];

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
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

    // Load the payment plus its check (for the tenant guard) and prior refunds.
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      with: {
        check: true,
        refunds: true,
      },
    });

    // Cross-tenant guard — MUST run before any Stripe call. The payment's check
    // must belong to the caller's org. check.organizationId is the canonical
    // tenant (stamped in C3.2, backfilled for old rows); payment.organizationId
    // is a defense-in-depth cross-check when present. Return 404 (not 403) so we
    // never leak the existence of another org's payment.
    if (
      !payment ||
      payment.check.organizationId !== ctx.organization.id ||
      (payment.organizationId != null && payment.organizationId !== ctx.organization.id)
    ) {
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

    // Create the refund in Stripe. paymentModel now comes from the location.
    const isConnect = ctx.location.paymentModel === "stripe_connect";
    let stripeRefund: Stripe.Refund;
    try {
      stripeRefund = await stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId,
          amount: refundAmount,
          ...(stripeReason ? { reason: stripeReason } : {}),
          // Destination charges: claw funds back from the restaurant's connected
          // account and return SplitPay's commission on the refunded portion.
          ...(isConnect ? { reverse_transfer: true, refund_application_fee: true } : {}),
        },
        {
          // Idempotency: a retry of the SAME intended refund (same payment, same
          // amount, same already-refunded baseline) reuses the Stripe refund
          // instead of creating a duplicate. A later, distinct refund has a
          // different baseline and so a different key.
          idempotencyKey: `refund:${payment.id}:${refundAmount}:${alreadyRefunded}`,
        }
      );
    } catch (error) {
      console.error("Stripe refund failed:", error);
      const message =
        error instanceof Stripe.errors.StripeError
          ? error.message
          : "Stripe refund failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // The Stripe refund already succeeded above; persist all three DB effects
    // (refund row, payment status, check rollback) atomically so a mid-write
    // failure can't leave money moved with no/partial record.
    const totalRefunded = alreadyRefunded + refundAmount;
    const newPaymentStatus =
      totalRefunded >= payment.totalCents ? "refunded" : "partially_refunded";
    const check = payment.check;
    const newPaidCents = Math.max(0, check.paidCents - refundAmount);
    const newCheckStatus =
      newPaidCents === 0 ? "open" :
      newPaidCents < check.totalCents ? "partially_paid" :
      "paid";

    const refund = await db.transaction(async (tx) => {
      // Record the refund
      const [created] = await tx
        .insert(refunds)
        .values({
          paymentId: payment.id,
          // Stamp the canonical tenant column (Stage C3.3).
          organizationId: ctx.organization.id,
          amountCents: refundAmount,
          reason: reason || null,
          stripeRefundId: stripeRefund.id,
          status: stripeRefund.status === "succeeded" ? "succeeded" : "pending",
          // Decision #4: attribute to the canonical users row. The legacy
          // venue_users column is left null during the expand phase.
          initiatedByUserIdNew: ctx.dbUser.id,
          completedAt: stripeRefund.status === "succeeded" ? new Date() : null,
        })
        .returning();

      // Update payment status
      await tx
        .update(payments)
        .set({ status: newPaymentStatus })
        .where(eq(payments.id, payment.id));

      // Roll the refunded amount back off the check so it reflects reality
      await tx
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

      return created;
    });

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
