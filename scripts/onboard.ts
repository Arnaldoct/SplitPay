/**
 * Onboarding Script: Add New Restaurant (Manual Mode)
 * 
 * This script sets up a new restaurant in manual mode.
 * Run with: npm run onboard
 * 
 * What it does:
 * 1. Creates venue in database
 * 2. Creates admin user account
 * 3. Creates integration (manual mode)
 * 4. Outputs login instructions
 */

import { db } from "../lib/db/index.js";
import { venues, venueUsers, integrations } from "../lib/db/schema.js";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

const rl = readline.createInterface({ input, output });

async function onboardRestaurant() {
  console.log("\n🎉 Welcome to SplitPay Restaurant Onboarding!\n");
  console.log("Let's set up a new restaurant in MANUAL mode.");
  console.log("(They'll use the dashboard to enter checks manually)\n");

  // Collect information
  const restaurantName = await rl.question("Restaurant name: ");
  const slug = await rl.question("URL slug (lowercase, no spaces): ");
  const email = await rl.question("Contact email: ");
  const phone = await rl.question("Phone (optional): ");
  const managerEmail = await rl.question("Manager email (for login): ");
  const managerName = await rl.question("Manager name: ");

  console.log("\n📍 Location (optional, can skip):");
  const address = await rl.question("Street address: ");
  const city = await rl.question("City: ");
  const state = await rl.question("State (2 letters): ");
  const zip = await rl.question("ZIP code: ");

  console.log("\n💡 Creating venue...");

  try {
    // Create venue
    const [venue] = await db
      .insert(venues)
      .values({
        name: restaurantName,
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        timezone: "America/New_York", // Default, can change later
        tipSuggestions: [18, 20, 22, 25],
        active: true,
      })
      .returning();

    console.log(`✅ Venue created: ${venue.name} (${venue.id})`);

    // Create manager user
    const [user] = await db
      .insert(venueUsers)
      .values({
        venueId: venue.id,
        email: managerEmail,
        name: managerName,
        role: "owner",
        active: true,
      })
      .returning();

    console.log(`✅ Manager account created: ${user.email}`);

    // Create integration (manual mode)
    const [integration] = await db
      .insert(integrations)
      .values({
        venueId: venue.id,
        provider: "manual",
        credentials: {},
        active: true,
      })
      .returning();

    console.log(`✅ Integration set to MANUAL mode`);

    // Output instructions
    console.log("\n" + "=".repeat(60));
    console.log("🎉 RESTAURANT ONBOARDED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n📋 Next Steps:\n");
    console.log(`1. Send login link to manager:`);
    console.log(`   ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/login`);
    console.log(`   Email: ${managerEmail}\n`);
    console.log(`2. They'll receive a magic link to login\n`);
    console.log(`3. First-time setup (5 minutes):`);
    console.log(`   - Go to "Tables & QR Codes"`);
    console.log(`   - Add tables (Table 1, 2, 3, etc.)`);
    console.log(`   - Generate QR codes for each table`);
    console.log(`   - Print and place QR codes on tables\n`);
    console.log(`4. Daily usage:`);
    console.log(`   - When guest orders, create check in dashboard`);
    console.log(`   - Enter items, prices, select table`);
    console.log(`   - Guest scans QR code → pays`);
    console.log(`   - View transactions in dashboard\n`);
    console.log(`📊 Venue Details:`);
    console.log(`   Name: ${venue.name}`);
    console.log(`   ID: ${venue.id}`);
    console.log(`   Slug: ${venue.slug}`);
    console.log(`   Manager: ${managerName} (${managerEmail})`);
    console.log(`   Mode: Manual (no POS integration)\n`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating restaurant:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505") {
      console.error("   → Slug already exists. Try a different slug.");
    }
    process.exit(1);
  }
}

onboardRestaurant();
