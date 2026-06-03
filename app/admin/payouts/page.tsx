import { requireAdmin, formatCents, calcCommission, calcVenueOwed } from "@/lib/admin";
import { db } from "@/lib/db";
import { venues, payments, checks, payouts } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { RecordPayoutForm } from "./RecordPayoutForm";

export default async function AdminPayoutsPage() {
  await requireAdmin();

  // Only aggregator venues need manual payouts
  const aggregatorVenues = await db.query.venues.findMany({
    where: (v, { eq }) => eq(v.paymentModel, "aggregator"),
    orderBy: (v, { asc }) => [asc(v.name)],
  });

  if (aggregatorVenues.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Payouts</h1>
        <p className="text-gray-400">No aggregator-model venues yet. Payouts only apply to restaurants in HN, GT, etc.</p>
      </div>
    );
  }

  const venueIds = aggregatorVenues.map((v) => v.id);

  // Total collected per venue (from succeeded payments)
  const volumeRows = await db
    .select({
      venueId:     checks.venueId,
      amountCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
      tipCents:    sql<number>`coalesce(sum(${payments.tipCents}), 0)`.mapWith(Number),
    })
    .from(payments)
    .innerJoin(checks, eq(payments.checkId, checks.id))
    .where(and(
      eq(payments.status, "succeeded"),
      sql`checks.venue_id = ANY(ARRAY[${sql.join(venueIds.map(id => sql`${id}::uuid`), sql`, `)}])`,
    ))
    .groupBy(checks.venueId);

  // Total paid out per venue (completed payouts)
  const payoutRows = await db
    .select({
      venueId:     payouts.venueId,
      paidOut:     sql<number>`coalesce(sum(${payouts.amountCents}), 0)`.mapWith(Number),
      lastPayoutAt: sql<Date | null>`max(${payouts.processedAt})`,
    })
    .from(payouts)
    .where(eq(payouts.status, "completed"))
    .groupBy(payouts.venueId);

  // Recent payout history (last 20 across all venues)
  const recentPayouts = await db.query.payouts.findMany({
    with: { venue: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    limit: 20,
  });

  const volumeMap = Object.fromEntries(volumeRows.map((r) => [r.venueId, r]));
  const payoutMap = Object.fromEntries(payoutRows.map((r) => [r.venueId, r]));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Payouts</h1>
      <p className="text-sm text-gray-400">
        Aggregator-model venues only. SplitPay collects funds and manually pays restaurants.
        Commission is 5% of the food amount (tips pass through 100%).
      </p>

      {/* Per-venue payout summary */}
      <div className="space-y-4">
        {aggregatorVenues.map((venue) => {
          const vol = volumeMap[venue.id];
          const po  = payoutMap[venue.id];
          const amountCents = vol?.amountCents ?? 0;
          const tipCents    = vol?.tipCents    ?? 0;
          const commission  = calcCommission(amountCents);
          const totalOwed   = calcVenueOwed(amountCents, tipCents);
          const paidOut     = po?.paidOut ?? 0;
          const netOwed     = Math.max(0, totalOwed - paidOut);

          return (
            <div key={venue.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{venue.name}</h3>
                  <p className="text-sm text-gray-500">{venue.country} · {venue.slug}</p>
                </div>
                <RecordPayoutForm
                  venueId={venue.id}
                  venueName={venue.name}
                  suggestedAmountCents={netOwed}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Gross Collected</p>
                  <p className="text-white font-medium">{formatCents(amountCents + tipCents)}</p>
                  <p className="text-gray-500 text-xs">{formatCents(amountCents)} food + {formatCents(tipCents)} tips</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">SplitPay Commission</p>
                  <p className="text-amber-400 font-medium">{formatCents(commission)}</p>
                  <p className="text-gray-500 text-xs">5% of food amount</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Total Paid Out</p>
                  <p className="text-white font-medium">{formatCents(paidOut)}</p>
                  {po?.lastPayoutAt && (
                    <p className="text-gray-500 text-xs">
                      Last: {new Date(po.lastPayoutAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Net Owed to Venue</p>
                  <p className={`text-xl font-bold ${netOwed > 0 ? "text-green-400" : "text-gray-500"}`}>
                    {formatCents(netOwed)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payout history */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Payout History</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Venue</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentPayouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No payouts recorded yet</td>
                </tr>
              )}
              {recentPayouts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-white">{p.venue?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-white font-medium">{formatCents(p.amountCents)}</td>
                  <td className="px-4 py-3 text-gray-300">{p.transferMethod ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{p.transferReference ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      p.status === "completed" ? "bg-green-900/50 text-green-400" :
                      p.status === "processing" ? "bg-blue-900/50 text-blue-300" :
                      "bg-gray-800 text-gray-400"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
