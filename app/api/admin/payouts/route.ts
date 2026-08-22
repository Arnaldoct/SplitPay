import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payouts } from "@/lib/db/schema";
import { requirePlatformAdmin } from "@/lib/dashboard-auth";

async function isAdmin() {
  const { ok } = await requirePlatformAdmin();
  return ok;
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { venueId, amountCents, transferMethod, transferReference, notes } = await request.json();

    if (!venueId || !amountCents || amountCents <= 0) {
      return NextResponse.json({ error: "venueId and amountCents are required" }, { status: 400 });
    }

    const [payout] = await db.insert(payouts).values({
      venueId,
      amountCents,
      currency: "USD",
      status: "completed",
      transferMethod: transferMethod || null,
      transferReference: transferReference || null,
      notes: notes || null,
      processedAt: new Date(),
    }).returning();

    return NextResponse.json(payout, { status: 201 });
  } catch (error) {
    console.error("Error recording payout:", error);
    return NextResponse.json({ error: "Failed to record payout" }, { status: 500 });
  }
}
