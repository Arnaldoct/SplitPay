/**
 * Payment Adapter Factory
 *
 * Returns the correct payment adapter for a venue based on its
 * paymentModel field. Mirrors lib/pos/factory.ts.
 *
 * paymentModel === 'aggregator'     → AggregatorAdapter   (HN, GT, etc.)
 * paymentModel === 'stripe_connect' → StripeConnectAdapter (US, MX, etc.)
 */

import { PaymentAdapter } from "./adapter";
import { AggregatorAdapter } from "./aggregator-adapter";
import { StripeConnectAdapter } from "./stripe-connect-adapter";

interface VenuePaymentConfig {
  paymentModel: string;
  stripeAccountId?: string | null;
  stripeOnboardingComplete?: boolean;
}

export function createPaymentAdapter(venue: VenuePaymentConfig): PaymentAdapter {
  switch (venue.paymentModel) {
    case "stripe_connect": {
      if (!venue.stripeAccountId || !venue.stripeOnboardingComplete) {
        console.warn(
          `Venue has paymentModel=stripe_connect but Stripe onboarding is incomplete. ` +
          `Falling back to aggregator adapter.`
        );
        return new AggregatorAdapter();
      }
      return new StripeConnectAdapter(venue.stripeAccountId);
    }

    case "aggregator":
    default:
      return new AggregatorAdapter();
  }
}

/**
 * Maps a country code to its default payment model.
 * Used when a new venue is created to auto-set paymentModel.
 */
export function getDefaultPaymentModel(country: string): string {
  const stripeConnectCountries = ["US", "CA", "MX", "GB", "AU", "NZ", "SG",
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
    "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "NO", "PL",
    "PT", "RO", "SK", "SI", "ES", "SE", "CH", "AE", "BR", "IN", "JP",
    "TH", "MY", "ID", "PH"];

  return stripeConnectCountries.includes(country.toUpperCase())
    ? "stripe_connect"
    : "aggregator";
}
