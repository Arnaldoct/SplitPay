/**
 * Stripe client configuration
 * Server-side only - never expose the secret key to the client
 */

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Use latest stable API version
  typescript: true,
});
