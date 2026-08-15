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
import { payments, checks, venues, payouts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";
import { sendReceipt } from "@/lib/email";

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
          with: {
            check: {
              with: {
                venue: true,
                table: true,
              },
            },
          },
        });

        if (payment) {
          // Update check paid amount
          const check = payment.check;

          if (check) {
            const newPaidCents = check.paidCents + payment.totalCents;
            const newStatus =
              newPaidCents >= check.totalCents ? "paid" : "partially_paid";

            await db
              .update(checks)
              .set({
                paidCents: newPaidCents,
                tipCents: check.tipCents + payment.tipCents,
                status: newStatus,
                closedAt: newStatus === "paid" ? new Date() : check.closedAt,
              })
              .where(eq(checks.id, payment.checkId));

            console.log(`✅ Payment ${paymentId} succeeded. Check ${check.id} is now ${newStatus}`);

            // Send receipt email if guest provided email
            if (payment.guestEmail) {
              try {
                await sendReceipt({
                  guestEmail: payment.guestEmail,
                  venueName: check.venue.name,
                  checkNumber: check.checkNumber || "N/A",
                  tableNumber: check.table?.tableNumber || "N/A",
                  amountCents: payment.amountCents,
                  tipCents: payment.tipCents,
                  totalCents: payment.totalCents,
                  splitMethod: payment.splitMethod,
                  paymentDate: payment.completedAt || new Date(),
                });
              } catch (error) {
                console.error("Failed to send receipt email:", error);
                // Don't fail the webhook if email fails
              }
            }
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

      case "account.updated": {
        // A restaurant progressed through (or regressed in) Connect onboarding.
        // Keep our onboarding flag in sync so the payment adapter and dashboard
        // banners reflect the real account state.
        const account = event.data.object as Stripe.Account;
        const isReady = Boolean(account.charges_enabled && account.payouts_enabled);

        const [venue] = await db
          .update(venues)
          .set({ stripeOnboardingComplete: isReady, updatedAt: new Date() })
          .where(eq(venues.stripeAccountId, account.id))
          .returning();

        if (venue) {
          console.log(
            `🔗 Connect account ${account.id} updated for venue ${venue.name}: ` +
            `charges=${account.charges_enabled} payouts=${account.payouts_enabled}`
          );
        }
        break;
      }

      case "payout.paid": {
        // Money landed in a restaurant's bank account (Connect venues).
        // The event fires on the connected account, so event.account tells us
        // which venue it belongs to.
        const payout = event.data.object as Stripe.Payout;
        const connectedAccountId = event.account;

        if (!connectedAccountId) break;

        const venue = await db.query.venues.findFirst({
          where: eq(venues.stripeAccountId, connectedAccountId),
        });

        if (!venue) {
          console.warn(`payout.paid for unknown account ${connectedAccountId}`);
          break;
        }

        // Idempotent: Stripe may deliver the same event more than once
        const existing = await db.query.payouts.findFirst({
          where: and(
            eq(payouts.venueId, venue.id),
            eq(payouts.transferReference, payout.id)
          ),
        });

        if (!existing) {
          await db.insert(payouts).values({
            venueId: venue.id,
            amountCents: payout.amount,
            currency: payout.currency.toUpperCase(),
            status: "completed",
            transferMethod: "stripe",
            transferReference: payout.id,
            processedAt: new Date(payout.arrival_date * 1000),
          });
          console.log(
            `💰 Payout ${payout.id} ($${(payout.amount / 100).toFixed(2)}) paid to ${venue.name}`
          );
        }
        break;
      }

      case "transfer.created": {
        // Destination-charge funds moved to a connected account.
        // Logged for reconciliation; the payment itself is tracked via
        // checkout.session.completed.
        const transfer = event.data.object as Stripe.Transfer;
        console.log(
          `↗️ Transfer ${transfer.id}: $${(transfer.amount / 100).toFixed(2)} → ${transfer.destination}`
        );
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
