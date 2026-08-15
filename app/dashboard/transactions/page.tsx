"use client";

import { useCallback, useEffect, useState } from "react";
import RefundModal, { RefundablePayment } from "./RefundModal";

interface Refund {
  id: string;
  amountCents: number;
  status: string;
}

interface Payment {
  id: string;
  amountCents: number;
  tipCents: number;
  totalCents: number;
  splitMethod: string;
  status: string;
  guestEmail: string | null;
  createdAt: string;
  completedAt: string | null;
  check: {
    checkNumber: string;
    table: {
      tableNumber: string;
    };
  };
  refunds: Refund[];
}

function refundedCents(payment: Payment) {
  return payment.refunds
    .filter((r) => r.status !== "failed")
    .reduce((sum, r) => sum + r.amountCents, 0);
}

export default function TransactionsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<RefundablePayment | null>(null);

  const fetchPayments = useCallback(async () => {
    const response = await fetch("/api/dashboard/transactions");
    if (response.ok) {
      const data = await response.json();
      setPayments(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Auth is enforced by middleware.ts for all /dashboard routes
    let cancelled = false;
    const load = async () => {
      const response = await fetch("/api/dashboard/transactions");
      if (cancelled) return;
      if (response.ok) {
        setPayments(await response.json());
      }
      setIsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const getStatusBadge = (status: string) => {
    const styles = {
      succeeded: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
      partially_refunded: "bg-orange-100 text-orange-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs rounded-full font-medium ${
          styles[status as keyof typeof styles] || styles.pending
        }`}
      >
        {status}
      </span>
    );
  };

  const getSplitMethodLabel = (method: string) => {
    const labels = {
      full: "Full",
      even: "Split Evenly",
      by_item: "By Item",
      custom: "Custom",
    };
    return labels[method as keyof typeof labels] || method;
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back
            </a>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {payments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <p className="text-gray-600 mb-4">No transactions yet</p>
            <p className="text-sm text-gray-500">
              Payments will appear here once guests start paying
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check / Table
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Split Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tip
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          Check #{payment.check.checkNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          Table {payment.check.table.tableNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getSplitMethodLabel(payment.splitMethod)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(payment.amountCents / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(payment.tipCents / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${(payment.totalCents / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payment.status)}
                        {refundedCents(payment) > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            −${(refundedCents(payment) / 100).toFixed(2)} refunded
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {(payment.status === "succeeded" ||
                          payment.status === "partially_refunded") && (
                          <button
                            onClick={() =>
                              setRefundTarget({
                                id: payment.id,
                                totalCents: payment.totalCents,
                                refundedCents: refundedCents(payment),
                                checkNumber: payment.check.checkNumber,
                              })
                            }
                            className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  Total transactions: {payments.length}
                </span>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Total Revenue</div>
                  <div className="text-lg font-bold text-gray-900">
                    $
                    {(
                      payments
                        .filter((p) => p.status === "succeeded")
                        .reduce((sum, p) => sum + p.totalCents, 0) / 100
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onRefunded={() => {
            setRefundTarget(null);
            fetchPayments();
          }}
        />
      )}
    </div>
  );
}
