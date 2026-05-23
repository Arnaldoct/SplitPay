/**
 * Toast POS Adapter
 * 
 * Integrates with Toast POS via their REST API.
 * Toast uses "checks" which map directly to our checks.
 * 
 * Toast Setup:
 * 1. Create a Toast developer account at pos.toasttab.com
 * 2. Get API credentials (client_id, client_secret)
 * 3. Get restaurant GUID
 * 4. Store credentials in integration
 * 
 * Toast API Docs: https://doc.toasttab.com/
 */

import { POSAdapter, POSCheck, POSCheckItem, POSAdapterConfig } from "./adapter";

interface ToastCheck {
  guid: string;
  checkNumber: string;
  tableName?: string;
  openedDate: string;
  closedDate?: string;
  deleted: boolean;
  selections: ToastSelection[];
  amount: number;
  taxAmount: number;
  totalAmount: number;
}

interface ToastSelection {
  guid: string;
  itemGuid: string;
  displayName: string;
  quantity: number;
  preDiscountPrice: number;
  price: number;
  tax: number;
}

export class ToastAdapter implements POSAdapter {
  readonly name = "toast";
  private accessToken: string;
  private restaurantGuid: string;
  private apiBaseUrl: string;

  constructor(config: POSAdapterConfig) {
    this.accessToken = config.credentials.accessToken;
    this.restaurantGuid = config.credentials.restaurantGuid;
    
    // Toast API base URL (different for production)
    this.apiBaseUrl = config.credentials.environment === "production"
      ? "https://ws-api.toasttab.com"
      : "https://ws-sandbox-api.toasttab.com";

    if (!this.accessToken) {
      throw new Error("Toast adapter requires accessToken in credentials");
    }

    if (!this.restaurantGuid) {
      throw new Error("Toast adapter requires restaurantGuid in credentials");
    }
  }

  async getCheck(externalId: string): Promise<POSCheck | null> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/orders/v2/checks/${externalId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Toast-Restaurant-External-ID": this.restaurantGuid,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Toast API error: ${response.status}`);
      }

      const toastCheck: ToastCheck = await response.json();
      return this.transformToastCheck(toastCheck);
    } catch (error) {
      console.error("Toast API error fetching check:", error);
      return null;
    }
  }

  async getOpenChecks(): Promise<POSCheck[]> {
    try {
      // Toast uses date ranges to fetch checks
      // Fetch checks from the last 24 hours
      const businessDate = new Date().toISOString().split("T")[0];

      const response = await fetch(
        `${this.apiBaseUrl}/orders/v2/checks?businessDate=${businessDate}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Toast-Restaurant-External-ID": this.restaurantGuid,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Toast API error: ${response.status}`);
      }

      const checks: ToastCheck[] = await response.json();

      // Filter to only open checks (not closed, not deleted)
      const openChecks = checks.filter(
        (check) => !check.closedDate && !check.deleted
      );

      return openChecks
        .map((check) => this.transformToastCheck(check))
        .filter((check): check is POSCheck => check !== null);
    } catch (error) {
      console.error("Toast API error fetching open checks:", error);
      return [];
    }
  }

  async recordPayment(
    checkExternalId: string,
    amountCents: number,
    paymentId: string
  ): Promise<void> {
    try {
      // Create an external payment in Toast
      await fetch(
        `${this.apiBaseUrl}/orders/v2/checks/${checkExternalId}/payments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Toast-Restaurant-External-ID": this.restaurantGuid,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "CREDIT",
            amount: amountCents / 100, // Toast uses dollars, not cents
            tipAmount: 0,
            paymentStatus: "CAPTURED",
            paidDate: new Date().toISOString(),
            externalId: paymentId,
            source: "SplitPay",
          }),
        }
      );

      console.log(
        `Toast adapter: Payment ${paymentId} recorded for check ${checkExternalId}`
      );
    } catch (error) {
      console.error("Toast API error recording payment:", error);
      throw error;
    }
  }

  /**
   * Transform a Toast Check into our POSCheck format
   */
  private transformToastCheck(check: ToastCheck): POSCheck | null {
    if (!check.guid) {
      return null;
    }

    // Transform line items (Toast calls them "selections")
    const items: POSCheckItem[] = (check.selections || [])
      .map((selection) => {
        if (!selection.guid || !selection.displayName) return null;

        return {
          externalId: selection.guid,
          name: selection.displayName,
          quantity: selection.quantity || 1,
          pricePerUnitCents: Math.round((selection.preDiscountPrice || 0) * 100),
          totalCents: Math.round((selection.price || 0) * 100),
        };
      })
      .filter((item): item is POSCheckItem => item !== null);

    // Toast uses dollars, we use cents
    const subtotalCents = Math.round((check.amount || 0) * 100);
    const taxCents = Math.round((check.taxAmount || 0) * 100);
    const totalCents = Math.round((check.totalAmount || 0) * 100);

    return {
      externalId: check.guid,
      checkNumber: check.checkNumber || undefined,
      tableIdentifier: check.tableName || undefined,
      subtotalCents: subtotalCents - taxCents,
      taxCents,
      totalCents,
      items,
      createdAt: new Date(check.openedDate),
      status: check.closedDate ? "closed" : "open",
    };
  }
}
