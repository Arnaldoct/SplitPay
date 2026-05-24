import { db } from "../lib/db/index.js";
import { payments } from "../lib/db/schema.js";
import { eq, desc } from "drizzle-orm";

async function completePayment() {
  // Get the most recent pending payment
  const [payment] = await db.select()
    .from(payments)
    .where(eq(payments.status, 'pending'))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  
  if (!payment) {
    console.log("❌ No pending payments found");
    process.exit(1);
  }
  
  // Update to succeeded
  await db.update(payments)
    .set({ status: 'succeeded' })
    .where(eq(payments.id, payment.id));
  
  console.log(`✅ Payment succeeded: $${(payment.amountCents / 100).toFixed(2)}`);
  console.log(`   Payment ID: ${payment.id}`);
  console.log(`   Now check the transactions page!`);
  
  process.exit(0);
}

completePayment();
