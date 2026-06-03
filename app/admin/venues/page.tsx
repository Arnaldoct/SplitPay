import { requireAdmin, formatCents, calcVenueOwed } from "@/lib/admin";
import { db } from "@/lib/db";
import { venues, payments, tables, checks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export default async function AdminVenuesPage() {
  await requireAdmin();

  const [allVenues, tableCounts, volumeRows] = await Promise.all([
    db.query.venues.findMany({ orderBy: (v, { asc }) => [asc(v.name)] }),

    db
      .select({ venueId: tables.venueId, count: sql<number>`count(*)`.mapWith(Number) })
      .from(tables)
      .where(eq(tables.active, true))
      .groupBy(tables.venueId),

    db
      .select({
        venueId:     checks.venueId,
        amountCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
        tipCents:    sql<number>`coalesce(sum(${payments.tipCents}), 0)`.mapWith(Number),
        txCount:     sql<number>`count(*)`.mapWith(Number),
      })
      .from(payments)
      .innerJoin(checks, eq(payments.checkId, checks.id))
      .where(eq(payments.status, "succeeded"))
      .groupBy(checks.venueId),
  ]);

  const tableMap = Object.fromEntries(tableCounts.map((r) => [r.venueId, r.count]));
  const volumeMap = Object.fromEntries(volumeRows.map((r) => [r.venueId, r]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Venues</h1>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Restaurant</th>
              <th className="px-4 py-3 text-left">Country</th>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-right">Tables</th>
              <th className="px-4 py-3 text-right">Transactions</th>
              <th className="px-4 py-3 text-right">Total Volume</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {allVenues.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">No venues yet</td>
              </tr>
            )}
            {allVenues.map((venue) => {
              const vol = volumeMap[venue.id];
              const totalVolume = vol ? vol.amountCents + vol.tipCents : 0;
              return (
                <tr key={venue.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{venue.name}</div>
                    <div className="text-gray-500 text-xs">{venue.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{venue.country}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      venue.paymentModel === "aggregator"
                        ? "bg-amber-900/50 text-amber-300"
                        : "bg-blue-900/50 text-blue-300"
                    }`}>
                      {venue.paymentModel === "aggregator" ? "Aggregator" : "Stripe Connect"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{tableMap[venue.id] ?? 0}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{vol?.txCount ?? 0}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{formatCents(totalVolume)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      venue.active ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-500"
                    }`}>
                      {venue.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
