/**
 * Seed script to populate database with test data
 * Run with: npm run db:seed
 */

import { db } from "../lib/db/index";
import { venues, tables, checks, checkItems } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...\n");

  try {
    // Create a test venue
    console.log("Creating test venue...");
    const [venue] = await db
      .insert(venues)
      .values({
        name: "The Purple Plate",
        slug: "purple-plate",
        email: "hello@purpleplate.com",
        phone: "(555) 123-4567",
        address: "123 Main Street",
        city: "Brooklyn",
        state: "NY",
        zip: "11201",
        timezone: "America/New_York",
        tipSuggestions: [18, 20, 22, 25],
        active: true,
      })
      .onConflictDoUpdate({
        target: venues.slug,
        set: { name: "The Purple Plate" },
      })
      .returning();

    console.log(`✅ Venue created: ${venue.name} (${venue.id})\n`);

    // Create a test table
    console.log("Creating test table...");
    const [table] = await db
      .insert(tables)
      .values({
        venueId: venue.id,
        tableNumber: "12",
        active: true,
      })
      .onConflictDoNothing()
      .returning();

    if (table) {
      console.log(`✅ Table created: Table ${table.tableNumber} (${table.id})\n`);
    } else {
      // Table already exists, fetch it
      const existingTable = await db.query.tables.findFirst({
        where: eq(tables.tableNumber, "12"),
      });
      if (existingTable) {
        console.log(`✅ Table exists: Table ${existingTable.tableNumber} (${existingTable.id})\n`);
      }
    }

    const targetTable = table || (await db.query.tables.findFirst({
      where: eq(tables.tableNumber, "12"),
    }));

    if (!targetTable) {
      throw new Error("Failed to create or find table");
    }

    // Create a test check
    console.log("Creating test check...");
    const subtotalCents = 8500; // $85.00
    const taxCents = 765; // $7.65 (9% tax)
    const totalCents = subtotalCents + taxCents; // $92.65

    const [check] = await db
      .insert(checks)
      .values({
        venueId: venue.id,
        tableId: targetTable.id,
        checkNumber: "1234",
        subtotalCents,
        taxCents,
        totalCents,
        paidCents: 0,
        tipCents: 0,
        status: "open",
      })
      .returning();

    console.log(`✅ Check created: #${check.checkNumber} - $${(totalCents / 100).toFixed(2)} (${check.id})\n`);

    // Create check items
    console.log("Creating check items...");
    const items = [
      { name: "Margherita Pizza", quantity: 1, pricePerUnitCents: 1800 },
      { name: "Caesar Salad", quantity: 2, pricePerUnitCents: 1400 },
      { name: "Spaghetti Carbonara", quantity: 1, pricePerUnitCents: 2200 },
      { name: "Tiramisu", quantity: 2, pricePerUnitCents: 900 },
      { name: "Glass of Chianti", quantity: 2, pricePerUnitCents: 1200 },
    ];

    for (const item of items) {
      const totalCents = item.quantity * item.pricePerUnitCents;
      await db.insert(checkItems).values({
        checkId: check.id,
        name: item.name,
        quantity: item.quantity,
        pricePerUnitCents: item.pricePerUnitCents,
        totalCents,
        claimedCents: 0,
      });
      console.log(`  ✅ ${item.quantity}x ${item.name} - $${(totalCents / 100).toFixed(2)}`);
    }

    console.log("\n🎉 Seed complete!\n");
    console.log("Test data:");
    console.log(`  Venue: ${venue.name}`);
    console.log(`  Table: ${targetTable.tableNumber}`);
    console.log(`  Check: #${check.checkNumber}`);
    console.log(`  Total: $${(totalCents / 100).toFixed(2)}`);
    console.log(`\nTest the guest flow at: http://localhost:3000/pay/${targetTable.id}\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
