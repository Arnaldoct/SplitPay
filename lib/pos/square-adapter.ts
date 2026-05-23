/**
 * Square POS Adapter
 * 
 * Integrates with Square POS to automatically sync orders/checks.
 * Uses Square's Orders API to fetch open checks and their line items.
 * 
 * Square Setup:
 * 1. Create a Square application at developer.squareup.com
 * 2. Get sandbox credentials for testing
 * 3. Store access token in integration credentials
 * 
 * Square calls them "orders" - we call them "checks"
 */

import { Client, Environment, Order, OrderLineItem } from "square";
import { POSAdapter, POSCheck, POSCheckItem, POSAdapterConfig } from "./adapter";

export class SquareAdapter implements POSAdapter {
  readonly name = "square";
  private client: Client;
  private locationId: string;

  constructor(config: POSAdapterConfig) {
    const accessToken = config.credentials.accessToken;
    const environment = config.credentials.environment || "sandbox";
    this.locationId = config.credentials.locationId;

    if (!accessToken) {
      throw new Error("Square adapter requires accessToken in credentials");
    }

    if (!this.locationId) {
      throw new Error("Square adapter requires locationId in credentials");
    }

    this.client = new Client({
      accessToken,
      environment: environment === "production" 
        ? Environment.Production 
        : Environment.Sandbox,
    });
  }

  async getCheck(externalId: string): Promise<POSCheck | null> {
    try {
      const { result } = await this.client.ordersApi.retrieveOrder(externalId);
      
      if (!result.order) {
        return null;
      }

      return this.transformSquareOrder(result.order);
    } catch (error) {
      console.error("Square API error fetching order:", error);
      return null;
    }
  }

  async getOpenChecks(): Promise<POSCheck[]> {
    try {
      // Search for open orders at this location
      const { result } = await this.client.ordersApi.searchOrders({
        locationIds: [this.locationId],
        query: {
          filter: {
            stateFilter: {
              states: ["OPEN", "DRAFT"],
            },
          },
          sort: {
            sortField: "CREATED_AT",
            sortOrder: "DESC",
          },
        },
        limit: 100, // Fetch up to 100 open orders
      });

      if (!result.orders) {
        return [];
      }

      return result.orders
        .map((order) => this.transformSquareOrder(order))
        .filter((check): check is POSCheck => check !== null);
    } catch (error) {
      console.error("Square API error fetching open orders:", error);
      return [];
    }
  }

  async recordPayment(
    checkExternalId: string,
    amountCents: number,
    paymentId: string
  ): Promise<void> {
    try {
      // Create a payment record in Square
      // This tells Square that this order has been paid (partially or fully)
      await this.client.paymentsApi.createPayment({
        sourceId: "EXTERNAL", // External payment source
        idempotencyKey: paymentId, // Use our payment ID for idempotency
        amountMoney: {
          amount: BigInt(amountCents),
          currency: "USD",
        },
        orderId: checkExternalId,
        externalDetails: {
          type: "OTHER",
          source: "SplitPay",
          sourceId: paymentId,
        },
        locationId: this.locationId,
      });

      console.log(
        `Square adapter: Payment ${paymentId} recorded for order ${checkExternalId}`
      );
    } catch (error) {
      console.error("Square API error recording payment:", error);
      throw error;
    }
  }

  /**
   * Transform a Square Order into our POSCheck format
   */
  private transformSquareOrder(order: Order): POSCheck | null {
    if (!order.id) {
      return null;
    }

    // Extract line items
    const items: POSCheckItem[] = (order.lineItems || [])
      .map((item: OrderLineItem) => {
        if (!item.uid || !item.name) return null;

        const quantity = Number(item.quantity) || 1;
        const pricePerUnitCents = Number(item.basePriceMoney?.amount) || 0;
        const totalCents = Number(item.totalMoney?.amount) || 0;

        return {
          externalId: item.uid,
          name: item.name,
          quantity,
          pricePerUnitCents: Number(pricePerUnitCents),
          totalCents: Number(totalCents),
        };
      })
      .filter((item): item is POSCheckItem => item !== null);

    // Calculate totals
    const subtotalCents = Number(order.totalMoney?.amount) || 0;
    const taxCents = Number(order.totalTaxMoney?.amount) || 0;
    const totalCents = subtotalCents;

    return {
      externalId: order.id,
      checkNumber: order.referenceId || undefined,
      tableIdentifier: order.ticketName || undefined,
      subtotalCents: subtotalCents - taxCents,
      taxCents,
      totalCents,
      items,
      createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
      status: order.state === "COMPLETED" ? "closed" : "open",
    };
  }
}
