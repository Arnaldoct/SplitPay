"use client";

/**
 * Staff floor view — a deliberately minimal screen for servers.
 *
 * Shows only active tables and their payment progress with large,
 * high-contrast type readable from across a dim dining room. No
 * transactions, refunds, Stripe, or settings — those stay in the
 * owner dashboard. Polls every 10 seconds so a table flipping to
 * "paid" shows up without a refresh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Wordmark } from "@/app/components/ui";

const POLL_INTERVAL_MS = 10_000;

interface ActiveCheck {
  id: string;
  checkNumber: string | null;
  totalCents: number;
  paidCents: number;
  status: "open" | "partially_paid";
  openedAt: string;
  table: { tableNumber: string } | null;
}

export default function StaffPage() {
  const [checks, setChecks] = useState<ActiveCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [justPaid, setJustPaid] = useState<string[]>([]);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const fetchChecks = useCallback(async () => {
    const res = await fetch("/api/dashboard/checks");
    if (res.ok) {
      const data: ActiveCheck[] = await res.json();

      // A check that was active last poll but is gone now just got fully paid
      const currentIds = new Set(data.map((c) => c.id));
      const paidTables = [...prevIdsRef.current].filter((id) => !currentIds.has(id));
      if (prevIdsRef.current.size > 0 && paidTables.length > 0) {
        setJustPaid(paidTables);
        setTimeout(() => setJustPaid([]), 8000);
      }
      prevIdsRef.current = currentIds;

      setChecks(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchChecks();
    const interval = setInterval(fetchChecks, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchChecks]);

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 sticky top-0 bg-gray-950/90 backdrop-blur-md z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Wordmark size="md" className="!text-white" />
            <span className="text-sm text-gray-400">Floor View</span>
          </div>
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            Full dashboard →
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {justPaid.length > 0 && (
          <div className="mb-6 rounded-2xl bg-emerald-600 text-white px-6 py-4 text-lg font-bold text-center animate-rise">
            A table just finished paying! 🎉
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-400 text-center py-16 text-lg">Loading tables…</p>
        ) : checks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl font-bold text-white mb-2">No open checks</p>
            <p className="text-gray-400">
              Active tables will appear here as soon as a check is opened.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {checks.map((check) => {
              const progress =
                check.totalCents > 0
                  ? Math.min(100, (check.paidCents / check.totalCents) * 100)
                  : 0;
              return (
                <div
                  key={check.id}
                  className="rounded-2xl bg-gray-900 border border-gray-800 p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl font-bold text-white">
                      Table {check.table?.tableNumber ?? "—"}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        check.status === "partially_paid"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-sky-500/20 text-sky-400"
                      }`}
                    >
                      {check.status === "partially_paid" ? "Paying" : "Open"}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-lg text-gray-300">
                      ${(check.paidCents / 100).toFixed(2)} of $
                      {(check.totalCents / 100).toFixed(2)} paid
                    </span>
                    <span className="text-lg font-semibold text-gray-100">
                      {Math.round(progress)}%
                    </span>
                  </div>

                  <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="mt-3 text-sm text-gray-500">
                    Check #{check.checkNumber ?? "N/A"} · opened{" "}
                    {new Date(check.openedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
