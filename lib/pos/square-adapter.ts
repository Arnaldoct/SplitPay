/**
 * Square POS Adapter
 * 
 * TODO: Implement Square integration (Stage 11)
 * For now, this is a stub to allow builds to pass.
 * We're only using manual mode for the pilot.
 */

import { POSAdapter, POSCheck, POSAdapterConfig } from "./adapter";

export class SquareAdapter implements POSAdapter {
  readonly name = "square";

  constructor(config: POSAdapterConfig) {
    throw new Error("Square integration not yet implemented. Use manual mode.");
  }

  async getOpenCheck(tableId: string): Promise<POSCheck | null> {
    throw new Error("Square integration not implemented");
  }

  async recordPayment(
    checkId: string,
    amountCents: number,
    tipCents: number,
    paymentIntentId: string
  ): Promise<void> {
    throw new Error("Square integration not implemented");
  }
}
