"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Wordmark } from "@/app/components/ui";
import StripeStatusBanner from "./StripeStatusBanner";
import {
  StoreIcon,
  TableIcon,
  ReceiptIcon,
  WalletIcon,
  LogoutIcon,
} from "@/app/components/icons";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/dashboard/login");
        return;
      }

      setUser(user);
      setIsLoading(false);
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push("/dashboard/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/dashboard/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-baseline gap-3">
              <Wordmark size="md" />
              <span className="text-sm text-gray-400 hidden sm:inline">
                Merchant Dashboard
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 hidden sm:inline">
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <LogoutIcon className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 animate-rise">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">
            Welcome back
          </h1>
          <p className="text-gray-500">
            Manage your venue, tables, and payments — all in one place.
          </p>
        </div>

        <StripeStatusBanner />

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-rise">
          <DashboardCard
            title="Manage Venue"
            description="Restaurant details & settings"
            icon={<StoreIcon className="w-6 h-6" />}
            href="/dashboard/venue"
          />
          <DashboardCard
            title="Tables & QR Codes"
            description="Create tables, generate QR codes"
            icon={<TableIcon className="w-6 h-6" />}
            href="/dashboard/tables"
          />
          <DashboardCard
            title="Create Check"
            description="Manually enter a new check"
            icon={<ReceiptIcon className="w-6 h-6" />}
            href="/dashboard/checks/new"
          />
          <DashboardCard
            title="Transactions"
            description="View payment history"
            icon={<WalletIcon className="w-6 h-6" />}
            href="/dashboard/transactions"
          />
          <DashboardCard
            title="Floor View"
            description="Live table status for servers"
            icon={<TableIcon className="w-6 h-6" />}
            href="/dashboard/staff"
          />
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  icon,
  href,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-violet-300 transition-all p-6"
    >
      <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:bg-violet-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}
