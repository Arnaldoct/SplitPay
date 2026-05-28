/**
 * API Route: Create Checkout Session
 *
 * Creates a payment session for the guest using the correct adapter
 * based on the venue's paymentModel:
 *   - 'aggregator'    → SplitPay's Stripe account (Honduras, Guatemala, etc.)
 *   - 'stripe_connect'→ Restaurant's connected Stripe account (US, Mexico, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checks, payments, claims, checkItems } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createPaymentAdapter } from "@/lib/payments/factory";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkId, splitMethod, amountCents, tipCents, selectedItems, guestEmail } = body;

    if (!checkId || !splitMethod) {
      return NextResponse.json(
        { error: "Missing checkId or splitMethod" },
        { status: 400 }
      );
    }

    const finalTipCents = tipCents || 0;

    // Fetch the check (include venue for payment model)
    const check = await db.query.checks.findFirst({
      where: eq(checks.id, checkId),
      with: {
        venue: true,
        checkItems: true,
      },
    });

    if (!check) {
      return NextResponse.json({ error: "Check not found" }, { status: 404 });
    }

    if (check.status === "paid") {
      return NextResponse.json(
        { error: "Check is already fully paid" },
        { status: 400 }
      );
    }

    // Resolve final amount based on split method
    let finalAmountCents: number;

    if (splitMethod === "full") {
      finalAmountCents = check.totalCents - check.paidCents;
    } else if (splitMethod === "by_item") {
      if (!selectedItems || selectedItems.length === 0) {
        return NextResponse.json({ error: "No items selected" }, { status: 400 });
      }
      const items = check.checkItems.filter((item) =>
        selectedItems.includes(item.id)
      );
      finalAmountCents = items.reduce(
        (sum, item) => sum + (item.totalCents - item.claimedCents),
        0
      );
    } else {
      finalAmountCents = amountCents;
    }

    if (finalAmountCents <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const remainingAmount = check.totalCents - check.paidCents;
    if (finalAmountCents > remainingAmount) {
      return NextResponse.json(
        { error: "Amount exceeds remaining balance" },
        { status: 400 }
      );
    }

    const guestSessionId = uuidv4();

    // Lock items for split-by-item
    if (splitMethod === "by_item" && selectedItems) {
      for (const itemId of selectedItems) {
        const item = check.checkItems.find((i) => i.id === itemId);
        if (item) {
          const claimAmount = item.totalCents - item.claimedCents;
          if (claimAmount > 0) {
            await db.insert(claims).values({
              checkItemId: itemId,
              guestSessionId,
              amountCents: claimAmount,
            });
            await db
              .update(checkItems)
              .set({ claimedCents: sql`${checkItems.claimedCents} + ${claimAmount}` })
              .where(eq(checkItems.id, itemId));
          }
        }
      }
    }

    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values({
        checkId: check.id,
        amountCents: finalAmountCents,
        tipCents: finalTipCents,
        totalCents: finalAmountCents + finalTipCents,
        splitMethod: splitMethod as "full" | "even" | "by_item" | "custom",
        status: "pending",
        guestSessionId,
        guestEmail: guestEmail || null,
      })
      .returning();

    // Build redirect URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${appUrl}/pay/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/pay/${check.tableId}`;

    // Pick the right payment adapter for this venue
    const adapter = createPaymentAdapter(check.venue);

    const result = await adapter.createCheckout({
      paymentId: payment.id,
      checkId: check.id,
      tableId: check.tableId,
      venueName: check.venue.name,
      checkNumber: check.checkNumber,
      amountCents: finalAmountCents,
      tipCents: finalTipCents,
      splitMethod,
      guestSessionId,
      successUrl,
      cancelUrl,
    });

    // Persist the session ID
    if (result.sessionId) {
      await db
        .update(payments)
        .set({ stripeCheckoutSessionId: result.sessionId })
        .where(eq(payments.id, payment.id));
    }

    return NextResponse.json({ url: result.url, provider: result.provider });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
