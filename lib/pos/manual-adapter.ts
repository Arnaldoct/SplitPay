/**
 * Manual POS Adapter
 * 
 * This adapter is used when the restaurant doesn't have a POS integration
 * or wants to manually enter checks through the dashboard.
 * 
 * This is the default for Stage 1 and what we use for pilots.
 */

import { POSAdapter, POSCheck, POSAdapterConfig } from "./adapter";
import { db } from "../db";
import { checks, checkItems } from "../db/schema";
import { eq } from "drizzle-orm";

export class ManualAdapter implements POSAdapter {
  readonly name = "manual";
  private venueId: string;

  constructor(config: POSAdapterConfig) {
    this.venueId = config.venueId;
  }

  async getCheck(externalId: string): Promise<POSCheck | null> {
    // For manual adapter, externalId is our check ID
    const check = await db.query.checks.findFirst({
      where: eq(checks.id, externalId),
      with: {
        checkItems: true,
      },
    });

    if (!check) return null;

    return {
      externalId: check.id,
      checkNumber: check.checkNumber || undefined,
      tableIdentifier: check.tableId || undefined,
      subtotalCents: check.subtotalCents,
      taxCents: check.taxCents,
      totalCents: check.totalCents,
      items: check.checkItems.map((item) => ({
        externalId: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnitCents: item.pricePerUnitCents,
        totalCents: item.totalCents,
      })),
      createdAt: check.createdAt,
      status: check.status === "paid" ? "closed" : "open",
    };
  }

  async getOpenChecks(): Promise<POSCheck[]> {
    const openChecks = await db.query.checks.findMany({
      where: (c, { eq: eqOp, and }) =>
        and(
          eqOp(c.venueId, this.venueId),
          eqOp(c.status, "open")
        ),
      with: {
        checkItems: true,
      },
    });

    return openChecks.map((check) => ({
      externalId: check.id,
      checkNumber: check.checkNumber || undefined,
      tableIdentifier: check.tableId || undefined,
      subtotalCents: check.subtotalCents,
      taxCents: check.taxCents,
      totalCents: check.totalCents,
      items: check.checkItems.map((item) => ({
        externalId: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnitCents: item.pricePerUnitCents,
        totalCents: item.totalCents,
      })),
      createdAt: check.createdAt,
      status: "open",
    }));
  }

  async createCheck(
    check: Omit<POSCheck, "externalId">
  ): Promise<POSCheck> {
    // Create check in our database
    const [newCheck] = await db
      .insert(checks)
      .values({
        venueId: this.venueId,
        tableId: check.tableIdentifier || null,
        checkNumber: check.checkNumber || `CHK-${Date.now()}`,
        subtotalCents: check.subtotalCents,
        taxCents: check.taxCents,
        totalCents: check.totalCents,
        paidCents: 0,
        tipCents: 0,
        status: "open",
      })
      .returning();

    // Create check items
    for (const item of check.items) {
      await db.insert(checkItems).values({
        checkId: newCheck.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnitCents: item.pricePerUnitCents,
        totalCents: item.totalCents,
        claimedCents: 0,
      });
    }

    return {
      externalId: newCheck.id,
      checkNumber: newCheck.checkNumber || undefined,
      tableIdentifier: newCheck.tableId || undefined,
      subtotalCents: newCheck.subtotalCents,
      taxCents: newCheck.taxCents,
      totalCents: newCheck.totalCents,
      items: check.items,
      createdAt: newCheck.createdAt,
      status: "open",
    };
  }

  async recordPayment(
    checkExternalId: string,
    amountCents: number,
    paymentId: string
  ): Promise<void> {
    // For manual adapter, payments are already recorded in our database
    // via the webhook handler, so this is a no-op
    console.log(
      `Manual adapter: Payment ${paymentId} for check ${checkExternalId} (${amountCents} cents) recorded`
    );
  }
}
