import { db } from "../lib/db/index.js";
import { payments, checks, venues } from "../lib/db/schema.js";

async function checkPayments() {
  const allPayments = await db.select().from(payments);
  console.log("\n💳 All Payments:");
  if (allPayments.length === 0) {
    console.log("   No payments found!");
  } else {
    for (const p of allPayments) {
      console.log(`   - $${(p.amountCents / 100).toFixed(2)} - ${p.status} - Check: ${p.checkId.slice(0,8)}...`);
    }
  }
  
  const allChecks = await db.select().from(checks);
  console.log("\n📋 All Checks:");
  for (const c of allChecks) {
    const tableId = c.tableId ? c.tableId.slice(0, 8) : 'none';
    const venueId = c.venueId.slice(0, 8);
    console.log(`   - Check #${c.checkNumber} - ${c.status} - Table: ${tableId}... - Venue: ${venueId}...`);
  }
  
  const allVenues = await db.select().from(venues);
  console.log("\n🏢 All Venues:");
  for (const v of allVenues) {
    console.log(`   - ${v.name} (${v.id})`);
  }
  
  process.exit(0);
}

checkPayments();
