import { db } from "@/lib/db";
import { checks, checkItems, venues, tables } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PayButton } from "./PayButton";

interface PageProps {
  params: Promise<{ tableId: string }>;
}

export default async function PayPage({ params }: PageProps) {
  const { tableId } = await params;

  // Fetch the open check for this table
  const check = await db.query.checks.findFirst({
    where: and(
      eq(checks.tableId, tableId),
      eq(checks.status, "open")
    ),
    with: {
      venue: true,
      table: true,
      checkItems: true,
    },
  });

  if (!check) {
    notFound();
  }

  const items = check.checkItems;
  const subtotal = check.subtotalCents / 100;
  const tax = check.taxCents / 100;
  const total = check.totalCents / 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-950">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-cream-100 mb-2">
            {check.venue.name}
          </h1>
          <p className="text-purple-200">Table {check.table?.tableNumber}</p>
          <p className="text-purple-300 text-sm mt-1">Check #{check.checkNumber}</p>
        </div>

        {/* Check Items */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Check</h2>
          
          <div className="space-y-3 mb-6">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  {item.quantity > 1 && (
                    <p className="text-sm text-gray-500">×{item.quantity}</p>
                  )}
                </div>
                <p className="font-medium text-gray-900">
                  ${(item.totalCents / 100).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-300">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Pay Button */}
        <PayButton checkId={check.id} amount={total} />

        <p className="text-center text-purple-200 text-sm mt-4">
          Secure payment powered by Stripe
        </p>
      </div>
    </div>
  );
}
