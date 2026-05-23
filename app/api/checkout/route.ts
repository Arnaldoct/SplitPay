/**
 * API Route: Create Stripe Checkout Session
 * Creates a hosted Checkout session for the guest to pay their check
 * Handles all split methods: full, even, by_item, custom
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { checks, payments, claims, checkItems } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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

    // Default tip to 0 if not provided
    const finalTipCents = tipCents || 0;

    // Fetch the check
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

    // Calculate amount based on split method
    let finalAmountCents: number;
    
    if (splitMethod === "full") {
      finalAmountCents = check.totalCents - check.paidCents;
    } else if (splitMethod === "by_item") {
      if (!selectedItems || selectedItems.length === 0) {
        return NextResponse.json(
          { error: "No items selected" },
          { status: 400 }
        );
      }
      
      // Calculate total from selected items (minus what's already claimed)
      const items = check.checkItems.filter((item) =>
        selectedItems.includes(item.id)
      );
      finalAmountCents = items.reduce(
        (sum, item) => sum + (item.totalCents - item.claimedCents),
        0
      );
    } else {
      // even or custom - use provided amount
      finalAmountCents = amountCents;
    }

    if (finalAmountCents <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const remainingAmount = check.totalCents - check.paidCents;
    if (finalAmountCents > remainingAmount) {
      return NextResponse.json(
        { error: "Amount exceeds remaining balance" },
        { status: 400 }
      );
    }

    // Generate guest session ID for tracking
    const guestSessionId = uuidv4();

    // For split-by-item, create claims to lock the items
    if (splitMethod === "by_item" && selectedItems) {
      for (const itemId of selectedItems) {
        const item = check.checkItems.find((i) => i.id === itemId);
        if (item) {
          const claimAmount = item.totalCents - item.claimedCents;
          
          if (claimAmount > 0) {
            // Create claim
            await db.insert(claims).values({
              checkItemId: itemId,
              guestSessionId,
              amountCents: claimAmount,
            });

            // Update item claimed amount
            await db
              .update(checkItems)
              .set({
                claimedCents: sql`${checkItems.claimedCents} + ${claimAmount}`,
              })
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
        splitMethod: splitMethod as any,
        status: "pending",
        guestSessionId,
        guestEmail: guestEmail || null,
      })
      .returning();

    // Create Stripe Checkout session
    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${check.venue.name} - Check #${check.checkNumber}`,
            description: `${splitMethod === "full" ? "Full payment" : splitMethod === "even" ? "Split evenly" : splitMethod === "by_item" ? "Split by item" : "Partial payment"}`,
          },
          unit_amount: finalAmountCents,
        },
        quantity: 1,
      },
    ];

    // Add tip as a separate line item if there is one
    if (finalTipCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Tip",
            description: "Gratuity for service",
          },
          unit_amount: finalTipCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${check.tableId}`,
      metadata: {
        paymentId: payment.id,
        checkId: check.id,
        splitMethod,
      },
    });

    // Update payment with Stripe session ID
    await db
      .update(payments)
      .set({
        stripeCheckoutSessionId: session.id,
      })
      .where(eq(payments.id, payment.id));

    // Return the checkout URL as JSON
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
