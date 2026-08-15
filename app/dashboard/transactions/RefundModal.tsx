"use client";

/**
 * Refund modal — lets a merchant issue a full or partial refund
 * for a completed payment, with a Stripe-compatible reason.
 */

import { useState } from "react";

const REASONS = [
  { value: "requested_by_customer", label: "Requested by customer" },
  { value: "duplicate", label: "Duplicate charge" },
  { value: "fraudulent", label: "Fraudulent" },
] as const;

export interface RefundablePayment {
  id: string;
  totalCents: number;
  refundedCents: number;
  checkNumber: string;
}

export default function RefundModal({
  payment,
  onClose,
  onRefunded,
}: {
  payment: RefundablePayment;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const refundableCents = payment.totalCents - payment.refundedCents;
  const [amount, setAmount] = useState((refundableCents / 100).toFixed(2));
  const [reason, setReason] = useState<string>("requested_by_customer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const isValid =
    Number.isInteger(amountCents) && amountCents > 0 && amountCents <= refundableCents;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, amountCents, reason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");

      onRefunded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Refund payment — Check #{payment.checkNumber}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Up to ${(refundableCents / 100).toFixed(2)} can be refunded. The money is
          reversed from your Stripe balance and returned to the guest&apos;s card.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="refund-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount (USD)
            </label>
            <input
              id="refund-amount"
              type="number"
              min="0.01"
              max={(refundableCents / 100).toFixed(2)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="refund-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <select
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Refunding…" : `Refund $${(amountCents / 100 || 0).toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
