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

  constructor(_config: POSAdapterConfig) {
    throw new Error("Square integration not yet implemented. Use manual mode.");
  }

  async getCheck(_externalId: string): Promise<POSCheck | null> {
    throw new Error("Square integration not implemented");
  }

  async getOpenChecks(): Promise<POSCheck[]> {
    throw new Error("Square integration not implemented");
  }

  async recordPayment(
    _checkExternalId: string,
    _amountCents: number,
    _paymentId: string
  ): Promise<void> {
    throw new Error("Square integration not implemented");
  }
}
