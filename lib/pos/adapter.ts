/**
 * POS Adapter Interface
 * 
 * This interface defines how SplitPay integrates with different POS systems.
 * Each POS system (Square, Clover, Toast, etc.) implements this interface.
 * 
 * The adapter pattern allows us to:
 * 1. Support multiple POS systems with the same core logic
 * 2. Test integrations in isolation
 * 3. Add new integrations without changing existing code
 */

export interface POSCheck {
  externalId: string; // The check/order ID in the POS system
  checkNumber?: string;
  tableIdentifier?: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  items: POSCheckItem[];
  createdAt: Date;
  status: "open" | "closed";
}

export interface POSCheckItem {
  externalId: string; // The item ID in the POS system
  name: string;
  quantity: number;
  pricePerUnitCents: number;
  totalCents: number;
}

export interface POSAdapter {
  /**
   * Unique identifier for this adapter (e.g., "square", "clover", "manual")
   */
  readonly name: string;

  /**
   * Fetch a single check by its external ID
   */
  getCheck(externalId: string): Promise<POSCheck | null>;

  /**
   * Fetch all open checks for a venue
   */
  getOpenChecks(): Promise<POSCheck[]>;

  /**
   * Create a new check (for manual entry or testing)
   * Not all adapters need to implement this
   */
  createCheck?(check: Omit<POSCheck, "externalId">): Promise<POSCheck>;

  /**
   * Mark a check as paid in the POS system
   * This is called after a successful payment
   */
  recordPayment?(
    checkExternalId: string,
    amountCents: number,
    paymentId: string
  ): Promise<void>;
}

/**
 * Configuration for a POS adapter instance
 */
export interface POSAdapterConfig {
  venueId: string;
  credentials: Record<string, string>; // API keys, tokens, etc.
}
