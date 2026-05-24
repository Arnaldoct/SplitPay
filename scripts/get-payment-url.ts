import { db } from "../lib/db/index.js";
import { tables } from "../lib/db/schema.js";
import { eq } from "drizzle-orm";

async function getTableUrl() {
  const allTables = await db.select().from(tables).where(eq(tables.tableNumber, '1'));
  if (allTables.length > 0) {
    const tableId = allTables[0].id;
    console.log('\n✅ Table 1 found!');
    console.log('\n📱 Payment URL:');
    console.log(`   http://localhost:3000/pay/${tableId}`);
    console.log('\n👉 Open this URL in your browser to test the guest payment flow!\n');
  } else {
    console.log('❌ No Table 1 found');
  }
  process.exit(0);
}

getTableUrl();
