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
import { getDefaultPaymentModel } from "../lib/payments/factory.js";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

const rl = readline.createInterface({ input, output });

const COUNTRY_OPTIONS: Record<string, { name: string; timezone: string }> = {
  HN: { name: "Honduras",    timezone: "America/Tegucigalpa" },
  GT: { name: "Guatemala",   timezone: "America/Guatemala"   },
  SV: { name: "El Salvador", timezone: "America/El_Salvador" },
  CR: { name: "Costa Rica",  timezone: "America/Costa_Rica"  },
  PA: { name: "Panama",      timezone: "America/Panama"      },
  MX: { name: "Mexico",      timezone: "America/Mexico_City" },
  US: { name: "United States", timezone: "America/New_York"  },
};

async function onboardRestaurant() {
  console.log("\nWelcome to SplitPay Restaurant Onboarding!\n");
  console.log("Sets up a new restaurant in MANUAL mode.");
  console.log("(They'll use the dashboard to enter checks manually)\n");

  // Basic info
  const restaurantName = await rl.question("Restaurant name: ");
  const slug = await rl.question("URL slug (lowercase, no spaces, e.g. la-ceiba): ");
  const email = await rl.question("Contact email (optional): ");
  const phone = await rl.question("Phone (optional): ");

  // Country — drives payment model and timezone
  console.log("\nCountry options:");
  Object.entries(COUNTRY_OPTIONS).forEach(([code, { name }]) => {
    console.log(`  ${code} - ${name}`);
  });
  const countryRaw = await rl.question("Country code (e.g. HN): ");
  const country = countryRaw.toUpperCase().trim();
  const countryInfo = COUNTRY_OPTIONS[country];
  if (!countryInfo) {
    console.error(`\nUnknown country code: ${country}. Add it to COUNTRY_OPTIONS in the script.`);
    process.exit(1);
  }

  const paymentModel = getDefaultPaymentModel(country);
  console.log(`\n  Payment model: ${paymentModel === "aggregator" ? "Aggregator (SplitPay collects, manual payout)" : "Stripe Connect (direct to restaurant)"}`);
  console.log(`  Timezone:      ${countryInfo.timezone}\n`);

  // Manager login credentials
  const managerEmail = (await rl.question("Manager email (for dashboard login): ")).toLowerCase().trim();
  const managerName = await rl.question("Manager name: ");

  // Location (optional)
  console.log("\nLocation (optional — press Enter to skip each):");
  const address = await rl.question("Street address: ");
  const city = await rl.question("City: ");
  const state = await rl.question("State / Department: ");
  const zip = await rl.question("ZIP / Postal code: ");

  console.log("\nCreating venue...");

  try {
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
        country,
        paymentModel,
        timezone: countryInfo.timezone,
        tipSuggestions: [18, 20, 22, 25],
        active: true,
      })
      .returning();

    console.log(`  Venue created: ${venue.name} (${venue.id})`);

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

    console.log(`  Manager account created: ${user.email}`);

    await db.insert(integrations).values({
      venueId: venue.id,
      provider: "manual",
      credentials: {},
      active: true,
    });

    console.log(`  Integration: MANUAL mode`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    console.log("\n" + "=".repeat(60));
    console.log("RESTAURANT ONBOARDED SUCCESSFULLY");
    console.log("=".repeat(60));
    console.log(`
Venue:          ${venue.name}
Country:        ${countryInfo.name} (${country})
Payment model:  ${paymentModel}
Timezone:       ${countryInfo.timezone}
Manager:        ${managerName} <${managerEmail}>

Next steps:
1. Send this login link to the manager:
   ${appUrl}/dashboard/login
   (They enter ${managerEmail} to receive a magic link)

2. First-time setup in the dashboard:
   - Tables & QR Codes → add tables → generate QR codes → print
   - Place QR codes on tables

3. Daily usage:
   - Create a check for the table when guests order
   - Guest scans QR → pays on their phone
   - Transactions appear in the dashboard immediately
`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\nError creating restaurant:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505") {
      console.error("  Slug already taken — try a different one.");
    }
    process.exit(1);
  }
}

onboardRestaurant();
