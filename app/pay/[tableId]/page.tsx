import { db } from "@/lib/db";
import { checks } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GuestPayFlow } from "./GuestPayFlow";

interface PageProps {
  params: Promise<{ tableId: string }>;
}

function CheckSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-gray-200 rounded-xl animate-pulse" />
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-20 animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function CheckContent({ tableId }: { tableId: string }) {
  if (!UUID_RE.test(tableId)) notFound();

  // Fetch the open OR partially_paid check for this table
  const check = await db.query.checks.findFirst({
    where: and(
      eq(checks.tableId, tableId),
      inArray(checks.status, ["open", "partially_paid"])
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

  const items = check.checkItems.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    totalCents: item.totalCents,
    claimedCents: item.claimedCents,
  }));

  return (
    <GuestPayFlow
      checkId={check.id}
      venueName={check.venue.name}
      tableNumber={check.table?.tableNumber ?? "—"}
      checkNumber={check.checkNumber ?? "N/A"}
      items={items}
      subtotalCents={check.subtotalCents}
      taxCents={check.taxCents}
      totalCents={check.totalCents}
      paidCents={check.paidCents}
      openedAt={check.openedAt.toISOString()}
    />
  );
}

export default async function PayPage({ params }: PageProps) {
  const { tableId } = await params;

  return (
    <Suspense fallback={<CheckSkeleton />}>
      <CheckContent tableId={tableId} />
    </Suspense>
  );
}
