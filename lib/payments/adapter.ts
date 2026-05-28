/**
 * Payment Adapter Interface
 *
 * Mirrors the POS adapter pattern (lib/pos/adapter.ts).
 * Each payment model (aggregator, stripe_connect) implements this interface.
 *
 * This abstraction lets us:
 * 1. Serve Honduras/Guatemala via the aggregator model today
 * 2. Add Stripe Connect for US/Mexico without touching checkout logic
 * 3. Add local processors (PayU, MercadoPago) in the future the same way
 */

export interface CheckoutParams {
  /** Internal payment record ID */
  paymentId: string;
  /** The check being paid */
  checkId: string;
  tableId: string | null;
  venueName: string;
  checkNumber: string | null;
  /** Amount the guest owes (excluding tip), in cents */
  amountCents: number;
  tipCents: number;
  splitMethod: string;
  guestSessionId: string;
  /** Where Stripe sends the guest after a successful payment */
  successUrl: string;
  /** Where Stripe sends the guest if they cancel */
  cancelUrl: string;
}

export interface CheckoutResult {
  /** Redirect the guest to this URL to complete payment */
  url: string;
  /** Processor-specific session/transaction ID for reconciliation */
  sessionId?: string;
  /** Which adapter handled this checkout */
  provider: string;
}

export interface PaymentAdapter {
  /** Unique identifier for this adapter */
  readonly name: string;

  /**
   * Create a checkout session and return the URL to redirect the guest to.
   */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
}
