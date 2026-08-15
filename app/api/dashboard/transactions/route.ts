/**
 * API Route: Get Transactions
 * Fetches all payments for the dashboard
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments, checks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";

// Helper — get the venue belonging to the current user
async function getUserVenue() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { user: null, venue: null };

  const venueUser = await db.query.venueUsers.findFirst({
    where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
    with: { venue: true },
  });

  return { user, venue: venueUser?.venue ?? null };
}

export async function GET() {
  try {
    const { user, venue } = await getUserVenue();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!venue) {
      return NextResponse.json({ error: "No venue found" }, { status: 404 });
    }

    // Get all checks for this venue
    const venueChecks = await db.query.checks.findMany({
      where: eq(checks.venueId, venue.id),
    });
    
    const checkIds = venueChecks.map(c => c.id);
    
    if (checkIds.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch all payments for these checks
    const allPayments = await db.query.payments.findMany({
      where: (p, { inArray }) => inArray(p.checkId, checkIds),
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
