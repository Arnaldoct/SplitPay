/**
 * API Route: Create Stripe Checkout Session
 * Creates a hosted Checkout session for the guest to pay their check
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { checks, payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const checkId = formData.get("checkId") as string;
    const splitMethod = formData.get("splitMethod") as string;

    if (!checkId || !splitMethod) {
      return NextResponse.json(
        { error: "Missing checkId or splitMethod" },
        { status: 400 }
      );
    }

    // Fetch the check
    const check = await db.query.checks.findFirst({
      where: eq(checks.id, checkId),
      with: {
        venue: true,
      },
    });

    if (!check) {
      return NextResponse.json({ error: "Check not found" }, { status: 404 });
    }

    if (check.status !== "open") {
      return NextResponse.json(
        { error: "Check is not open" },
        { status: 400 }
      );
    }

    // Calculate amount (for "full" split method, it's the full remaining amount)
    const amountCents = check.totalCents - check.paidCents;

    if (amountCents <= 0) {
      return NextResponse.json(
        { error: "Check is already paid" },
        { status: 400 }
      );
    }

    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values({
        checkId: check.id,
        amountCents,
        tipCents: 0, // We'll add tip selection in Stage 9
        totalCents: amountCents,
        splitMethod: splitMethod as any,
        status: "pending",
      })
      .returning();

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${check.venue.name} - Check #${check.checkNumber}`,
              description: `Payment for Table ${check.tableId}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${check.tableId}`,
      metadata: {
        paymentId: payment.id,
        checkId: check.id,
      },
    });

    // Update payment with Stripe session ID
    await db
      .update(payments)
      .set({
        stripeCheckoutSessionId: session.id,
      })
      .where(eq(payments.id, payment.id));

    // Redirect to Stripe Checkout
    return NextResponse.redirect(session.url!);
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
