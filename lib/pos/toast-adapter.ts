/**
 * Toast POS Adapter
 * 
 * TODO: Implement Toast integration (Stage 11)
 * For now, this is a stub to allow builds to pass.
 * We're only using manual mode for the pilot.
 */

import { POSAdapter, POSCheck, POSAdapterConfig } from "./adapter";

export class ToastAdapter implements POSAdapter {
  readonly name = "toast";

  constructor(_config: POSAdapterConfig) {
    throw new Error("Toast integration not yet implemented. Use manual mode.");
  }

  async getCheck(_externalId: string): Promise<POSCheck | null> {
    throw new Error("Toast integration not implemented");
  }

  async getOpenChecks(): Promise<POSCheck[]> {
    throw new Error("Toast integration not implemented");
  }

  async recordPayment(
    _checkExternalId: string,
    _amountCents: number,
    _paymentId: string
  ): Promise<void> {
    throw new Error("Toast integration not implemented");
  }
}
