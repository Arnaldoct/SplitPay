/**
 * Simple Onboarding Script - Just pass arguments
 * 
 * Usage:
 * npm run onboard:simple "Restaurant Name" "slug" "manager@email.com" "Manager Name"
 */

import { db } from "../lib/db/index.js";
import { venues, venueUsers, integrations } from "../lib/db/schema.js";

const [restaurantName, slug, managerEmail, managerName] = process.argv.slice(2);

if (!restaurantName || !slug || !managerEmail || !managerName) {
  console.error("\n❌ Missing required arguments!\n");
  console.log("Usage:");
  console.log('  npm run onboard:simple "Restaurant Name" "slug" "manager@email.com" "Manager Name"\n');
  console.log("Example:");
  console.log('  npm run onboard:simple "Test Cafe" "test-cafe" "chef@testcafe.com" "Chef Maria"\n');
  process.exit(1);
}

async function onboardRestaurant() {
  console.log("\n🚀 Creating restaurant...\n");

  try {
    // Create venue
    const [venue] = await db
      .insert(venues)
      .values({
        name: restaurantName,
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        email: null,
        phone: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        timezone: "America/New_York",
        tipSuggestions: [18, 20, 22, 25],
        active: true,
      })
      .returning();

    console.log(`✅ Venue created: ${venue.name}`);

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
    await db
      .insert(integrations)
      .values({
        venueId: venue.id,
        provider: "manual",
        credentials: {},
        active: true,
      })
      .returning();

    console.log(`✅ Integration set to MANUAL mode\n`);

    // Output instructions
    console.log("=".repeat(60));
    console.log("🎉 RESTAURANT ONBOARDED!");
    console.log("=".repeat(60));
    console.log("\n📋 Next Steps:\n");
    console.log(`1. Manager Login:`);
    console.log(`   URL: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/login`);
    console.log(`   Email: ${managerEmail}`);
    console.log(`   (Check email for magic link)\n`);
    console.log(`2. Setup (5 min):`);
    console.log(`   - Add tables`);
    console.log(`   - Generate QR codes`);
    console.log(`   - Create test check\n`);
    console.log(`📊 Venue Info:`);
    console.log(`   Name: ${venue.name}`);
    console.log(`   Slug: ${venue.slug}`);
    console.log(`   ID: ${venue.id}`);
    console.log(`   Manager: ${managerName} (${managerEmail})\n`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error("\n❌ Error:", err.message);
    if (err.code === "23505") {
      console.error("   → Slug already exists. Try a different slug.\n");
    }
    process.exit(1);
  }
}

onboardRestaurant();
