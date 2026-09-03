/**
 * API Route: Get Transactions
 * Fetches all payments for the logged-in user's organization.
 *
 * Stage C3: scopes directly by `payments.organization_id` (added in C1) instead
 * of the old "fetch every check for the venue, then filter payments by those
 * check ids" two-step. Resolved via requireTenantContext (org-only; location is
 * irrelevant here, so it never 409s on an ambiguous location).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireTenantContext } from "@/lib/dashboard-auth";

export async function GET() {
  try {
    const ctx = await requireTenantContext({ location: "optional" });
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const allPayments = await db.query.payments.findMany({
      where: eq(payments.organizationId, ctx.organization.id),
      with: {
        check: {
          with: {
            table: true,
          },
        },
        refunds: true,
      },
      orderBy: [desc(payments.createdAt)],
    });

    return NextResponse.json(allPayments);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
