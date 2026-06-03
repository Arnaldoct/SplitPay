import { requireAdmin, calcCommission, formatCents } from "@/lib/admin";
import { db } from "@/lib/db";
import { venues, payments } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import Link from "next/link";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    allVenues,
    allTimePayments,
    thisMonthPayments,
    recentPayments,
  ] = await Promise.all([
    db.select({ id: venues.id, active: venues.active }).from(venues),

    db.select({
      amountCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
      tipCents:    sql<number>`coalesce(sum(${payments.tipCents}), 0)`.mapWith(Number),
    })
      .from(payments)
      .where(eq(payments.status, "succeeded")),

    db.select({
      amountCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
      tipCents:    sql<number>`coalesce(sum(${payments.tipCents}), 0)`.mapWith(Number),
    })
      .from(payments)
      .where(and(eq(payments.status, "succeeded"), gte(payments.createdAt, startOfMonth))),

    db.query.payments.findMany({
      where: eq(payments.status, "succeeded"),
      with: { check: { with: { venue: true, table: true } } },
      orderBy: (p, ops) => [ops.desc(p.createdAt)],
      limit: 10,
    }),
  ]);

  const activeVenues = allVenues.filter((v: { active: boolean }) => v.active).length;
  const allTimeAmount = allTimePayments[0]?.amountCents ?? 0;
  const allTimeCommission = calcCommission(allTimeAmount);
  const monthAmount = thisMonthPayments[0]?.amountCents ?? 0;
  const monthCommission = calcCommission(monthAmount);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Venues" value={String(activeVenues)} />
        <StatCard label="All-Time Volume" value={formatCents(allTimeAmount)} />
        <StatCard label="All-Time Commission" value={formatCents(allTimeCommission)} sub="5% of food amount" />
        <StatCard label="This Month Commission" value={formatCents(monthCommission)} sub={formatCents(monthAmount) + " volume"} />
      </div>

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
          <Link href="/admin/transactions" className="text-sm text-purple-400 hover:text-purple-300">
            View all →
          </Link>
        </div>
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
              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">No transactions yet</td>
                </tr>
              )}
              {recentPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-white">{p.check?.venue?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {p.check?.table?.tableNumber ? `Table ${p.check.table.tableNumber}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-300 capitalize">{p.splitMethod.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{formatCents(p.amountCents)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{formatCents(p.tipCents)}</td>
                  <td className="px-4 py-3 text-right text-white font-medium">{formatCents(p.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
