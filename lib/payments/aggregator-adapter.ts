/**
 * Aggregator Payment Adapter
 *
 * Used for venues in countries where Stripe Connect is unavailable
 * (Honduras, Guatemala, etc.).
 *
 * How it works:
 * - Guests pay via SplitPay's own Stripe account (no Connect)
 * - Funds land in SplitPay's Stripe dashboard
 * - SplitPay pays the restaurant manually via Wise, bank transfer, etc.
 * - Payouts are tracked in the `payouts` table
 *
 * When to use: venue.paymentModel === 'aggregator'
 */

import { stripe } from "@/lib/stripe";
import { PaymentAdapter, CheckoutParams, CheckoutResult } from "./adapter";

export class AggregatorAdapter implements PaymentAdapter {
  readonly name = "aggregator";

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

    const splitLabel =
      splitMethod === "full" ? "Full payment" :
      splitMethod === "even" ? "Split evenly" :
      splitMethod === "by_item" ? "Split by item" :
      "Partial payment";

    // Build session — charge goes to SplitPay's account, no transfer_data
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
