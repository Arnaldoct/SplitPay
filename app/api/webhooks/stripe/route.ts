/**
 * Stripe Webhook Handler
 * Listens for Stripe events and updates payment status in our database
 * 
 * IMPORTANT: Stripe webhooks require raw body parsing, not JSON.
 * We need to disable Next.js body parsing for this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { payments, checks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

// Disable body parsing so we can verify webhook signature
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "No signature provided" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    // For now, we'll skip signature verification in development
    // TODO: Add STRIPE_WEBHOOK_SECRET to .env.local and verify in production
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // In development without webhook secret, parse the body directly
      event = JSON.parse(body) as Stripe.Event;
      console.warn("⚠️ Webhook signature verification is disabled. Set STRIPE_WEBHOOK_SECRET in production.");
    }
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.paymentId;

        if (!paymentId) {
          console.error("No paymentId in session metadata");
          break;
        }

        // Update payment status
        await db
          .update(payments)
          .set({
            status: "succeeded",
            stripePaymentIntentId: session.payment_intent as string,
            completedAt: new Date(),
          })
          .where(eq(payments.id, paymentId));

        // Get the payment to update the check
        const payment = await db.query.payments.findFirst({
          where: eq(payments.id, paymentId),
        });

        if (payment) {
          // Update check paid amount
          const check = await db.query.checks.findFirst({
            where: eq(checks.id, payment.checkId),
          });

          if (check) {
            const newPaidCents = check.paidCents + payment.totalCents;
            const newStatus =
              newPaidCents >= check.totalCents ? "paid" : "partially_paid";

            await db
              .update(checks)
              .set({
                paidCents: newPaidCents,
                status: newStatus,
                closedAt: newStatus === "paid" ? new Date() : check.closedAt,
              })
              .where(eq(checks.id, payment.checkId));

            console.log(`✅ Payment ${paymentId} succeeded. Check ${check.id} is now ${newStatus}`);
          }
        }

        break;
      }

      case "checkout.session.expired":
      case "payment_intent.payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.paymentId;

        if (paymentId) {
          await db
            .update(payments)
            .set({
              status: "failed",
              errorMessage: "Payment failed or session expired",
            })
            .where(eq(payments.id, paymentId));

          console.log(`❌ Payment ${paymentId} failed`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
