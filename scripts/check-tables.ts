import { db } from "../lib/db/index.js";
import { tables, venues } from "../lib/db/schema.js";

async function checkTables() {
  const allVenues = await db.select().from(venues);
  console.log("\n📍 All Venues:");
  allVenues.forEach(v => console.log(`  - ${v.name} (${v.id})`));
  
  const allTables = await db.select().from(tables);
  console.log("\n📋 All Tables:");
  allTables.forEach(t => console.log(`  - Table ${t.tableNumber} (ID: ${t.id.slice(0,8)}..., Venue: ${t.venueId.slice(0,8)}...)`));
  
  process.exit(0);
}

checkTables();
