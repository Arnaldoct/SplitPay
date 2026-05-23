/**
 * API Route: Get Transactions
 * Fetches all payments for the dashboard
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { venues, payments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    // Get venue (for now, use the first venue)
    const venue = await db.query.venues.findFirst();
    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    // Fetch all payments for this venue's checks
    const allPayments = await db.query.payments.findMany({
      where: (p, { exists, and, eq: eqOp }) =>
        exists(
          db
            .select()
            .from(db._.schema.checks)
            .where(
              and(
                eqOp(db._.schema.checks.id, p.checkId),
                eqOp(db._.schema.checks.venueId, venue.id)
              )
            )
        ),
      with: {
        check: {
          with: {
            table: true,
          },
        },
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
