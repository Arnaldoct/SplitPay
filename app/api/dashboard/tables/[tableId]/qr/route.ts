/**
 * API Route: Generate QR Code for Table
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;

    // Get the table
    const table = await db.query.tables.findFirst({
      where: eq(tables.id, tableId),
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Generate QR code
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${tableId}`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Update table with QR code
    await db
      .update(tables)
      .set({ qrCodeUrl: qrCodeDataUrl })
      .where(eq(tables.id, tableId));

    return NextResponse.json({ qrCodeUrl: qrCodeDataUrl });
  } catch (error) {
    console.error("Error generating QR code:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
