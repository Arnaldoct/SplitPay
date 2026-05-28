/**
 * Stripe Connect Payment Adapter
 *
 * Used for venues in countries where Stripe Connect is available
 * (US, Mexico, Canada, etc.).
 *
 * How it works:
 * - Guests pay via SplitPay's platform Stripe account
 * - Funds are transferred directly to the restaurant's connected Stripe account
 * - Restaurant gets paid automatically — no manual payout needed
 * - SplitPay can optionally take an application fee per transaction
 *
 * When to use: venue.paymentModel === 'stripe_connect'
 * Requires: venue.stripeAccountId + venue.stripeOnboardingComplete === true
 */

import { stripe } from "@/lib/stripe";
import { PaymentAdapter, CheckoutParams, CheckoutResult } from "./adapter";

// Optional platform fee — set to 0 to disable
const PLATFORM_FEE_CENTS = 0;

export class StripeConnectAdapter implements PaymentAdapter {
  readonly name = "stripe_connect";
  private stripeAccountId: string;

  constructor(stripeAccountId: string) {
    this.stripeAccountId = stripeAccountId;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const {
      paymentId,
      checkId,
      venueName,
      checkNumber,
      amountCents,
      tipCents,
      splitMethod,
      successUrl,
      cancelUrl,
    } = params;

    const totalCents = amountCents + tipCents;

    const splitLabel =
      splitMethod === "full" ? "Full payment" :
      splitMethod === "even" ? "Split evenly" :
      splitMethod === "by_item" ? "Split by item" :
      "Partial payment";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${venueName} — Check #${checkNumber ?? "N/A"}`,
              description: splitLabel,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
        ...(tipCents > 0 ? [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "Tip",
              description: "Gratuity for service",
            },
            unit_amount: tipCents,
          },
          quantity: 1,
        }] : []),
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Destination charge — funds go to the restaurant's connected account
      payment_intent_data: {
        transfer_data: {
          destination: this.stripeAccountId,
        },
        ...(PLATFORM_FEE_CENTS > 0
          ? { application_fee_amount: Math.min(PLATFORM_FEE_CENTS, totalCents - 1) }
          : {}),
      },
      metadata: {
        paymentId,
        checkId,
        splitMethod,
        provider: this.name,
      },
    });

    return {
      url: session.url!,
      sessionId: session.id,
      provider: this.name,
    };
  }
}
