import { requireAdmin, formatCents } from "@/lib/admin";
import { db } from "@/lib/db";
import { payments, checks, venues, tables } from "@/lib/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import Link from "next/link";

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ venue?: string; from?: string; to?: string; page?: string }>;
}

export default async function AdminTransactionsPage({ searchParams }: Props) {
  await requireAdmin();

  const params = await searchParams;
  const venueFilter = params.venue ?? "";
  const fromFilter  = params.from  ?? "";
  const toFilter    = params.to    ?? "";
  const page        = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset      = (page - 1) * PAGE_SIZE;

  // Build filter conditions
  const conditions = [eq(payments.status, "succeeded")];
  if (fromFilter) conditions.push(gte(payments.createdAt, new Date(fromFilter)));
  if (toFilter)   conditions.push(lte(payments.createdAt, new Date(toFilter + "T23:59:59")));

  const [allVenuesList, rows, countRow] = await Promise.all([
    db.select({ id: venues.id, name: venues.name }).from(venues).orderBy(venues.name),

    db
      .select({
        id:            payments.id,
        amountCents:   payments.amountCents,
        tipCents:      payments.tipCents,
        totalCents:    payments.totalCents,
        splitMethod:   payments.splitMethod,
        createdAt:     payments.createdAt,
        venueName:     venues.name,
        venueCountry:  venues.country,
        tableNumber:   tables.tableNumber,
      })
      .from(payments)
      .innerJoin(checks, eq(payments.checkId, checks.id))
      .innerJoin(venues, eq(checks.venueId, venues.id))
      .leftJoin(tables, eq(checks.tableId, tables.id))
      .where(and(
        ...conditions,
        ...(venueFilter ? [eq(venues.id, venueFilter)] : []),
      ))
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(payments)
      .innerJoin(checks, eq(payments.checkId, checks.id))
      .innerJoin(venues, eq(checks.venueId, venues.id))
      .where(and(
        ...conditions,
        ...(venueFilter ? [eq(venues.id, venueFilter)] : []),
      )),
  ]);

  const totalRows  = countRow[0]?.total ?? 0;
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (venueFilter) sp.set("venue", venueFilter);
    if (fromFilter)  sp.set("from", fromFilter);
    if (toFilter)    sp.set("to", toFilter);
    if (p > 1) sp.set("page", String(p));
    return `/admin/transactions${sp.toString() ? "?" + sp.toString() : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <span className="text-sm text-gray-500">{totalRows.toLocaleString()} total</span>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        <select
          name="venue"
          defaultValue={venueFilter}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2"
        >
          <option value="">All venues</option>
          {allVenuesList.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <input
          type="date" name="from" defaultValue={fromFilter}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2"
        />
        <input
          type="date" name="to" defaultValue={toFilter}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2"
        />
        <button
          type="submit"
          className="bg-purple-700 hover:bg-purple-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Filter
        </button>
        {(venueFilter || fromFilter || toFilter) && (
          <Link href="/admin/transactions" className="text-sm text-gray-400 hover:text-gray-200 px-3 py-2">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Venue</th>
              <th className="px-4 py-3 text-left">Table</th>
              <th className="px-4 py-3 text-left">Split</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Tip</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No transactions found
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                  {new Date(p.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className="text-white">{p.venueName}</span>
                  <span className="text-gray-500 text-xs ml-2">{p.venueCountry}</span>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {p.tableNumber ? `Table ${p.tableNumber}` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-300 capitalize">
                  {p.splitMethod.replace("_", " ")}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{formatCents(p.amountCents)}</td>
                <td className="px-4 py-3 text-right text-gray-400">{formatCents(p.tipCents)}</td>
                <td className="px-4 py-3 text-right text-white font-medium">{formatCents(p.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageUrl(page - 1)} className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700">
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(page + 1)} className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
