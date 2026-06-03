import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top nav */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <span className="font-serif font-bold text-lg text-white">
                SplitPay <span className="text-purple-400 text-sm font-sans font-normal">Admin</span>
              </span>
              <nav className="flex gap-6 text-sm">
                <Link href="/admin" className="text-gray-300 hover:text-white transition-colors">Overview</Link>
                <Link href="/admin/venues" className="text-gray-300 hover:text-white transition-colors">Venues</Link>
                <Link href="/admin/transactions" className="text-gray-300 hover:text-white transition-colors">Transactions</Link>
                <Link href="/admin/payouts" className="text-gray-300 hover:text-white transition-colors">Payouts</Link>
              </nav>
            </div>
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
