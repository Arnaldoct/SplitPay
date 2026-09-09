/**
 * API Route: Checks
 * POST — manual check entry from the dashboard
 * GET  — active checks (open / partially paid) for the staff floor view
 *
 * Stage C3: scoped by location_id via requireTenantContext (location required).
 * POST wraps the check + all its check_items in a single transaction and stamps
 * the canonical tenant columns.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checks, checkItems, tables } from "@/lib/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { requireTenantContext } from "@/lib/dashboard-auth";

export async function GET() {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const activeChecks = await db.query.checks.findMany({
      where: and(
        eq(checks.locationId, ctx.location.id),
        inArray(checks.status, ["open", "partially_paid"])
      ),
      with: { table: true },
      orderBy: [desc(checks.openedAt)],
    });

    return NextResponse.json(activeChecks);
  } catch (error) {
    console.error("Error fetching active checks:", error);
    return NextResponse.json(
      { error: "Failed to fetch checks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const body = await request.json();
    const { tableId, checkNumber, subtotalCents, taxCents, totalCents, items } = body;

    if (!tableId || !totalCents || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Ownership: the target table must belong to the caller's resolved location
    // (same tenant-isolation pattern as the QR route). Return 404 for a foreign
    // or unknown table so we don't leak its existence.
    const table = await db.query.tables.findFirst({
      where: eq(tables.id, tableId),
    });
    if (!table || table.locationId !== ctx.location.id) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Create the check and all its items in ONE transaction, so a mid-insert
    // failure can't leave an orphaned check with no items (the prior code did
    // sequential, non-transactional inserts).
    const check = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(checks)
        .values({
          // Canonical tenant columns.
          locationId: ctx.location.id,
          organizationId: ctx.organization.id,
          // venue_id is still NOT NULL until the contract migration. Backfill
          // invariant locations.id == venues.id, so the location id is the
          // venue id — keeps the legacy FK satisfied and consistent.
          venueId: ctx.location.id,
          tableId,
          checkNumber: checkNumber || `CHK-${Date.now()}`,
          subtotalCents,
          taxCents,
          totalCents,
          paidCents: 0,
          tipCents: 0,
          status: "open",
        })
        .returning();

      await tx.insert(checkItems).values(
        items.map(
          (item: {
            name: string;
            quantity: number;
            pricePerUnitCents: number;
            totalCents: number;
          }) => ({
            checkId: created.id,
            // Stamp the organization on each item (Stage C3).
            organizationId: ctx.organization.id,
            name: item.name,
            quantity: item.quantity,
            pricePerUnitCents: item.pricePerUnitCents,
            totalCents: item.totalCents,
            claimedCents: 0,
          })
        )
      );

      return created;
    });

    return NextResponse.json(check);
  } catch (error) {
    console.error("Error creating check:", error);
    return NextResponse.json(
      { error: "Failed to create check" },
      { status: 500 }
    );
  }
}
