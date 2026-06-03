"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  venueId: string;
  venueName: string;
  suggestedAmountCents: number;
}

const TRANSFER_METHODS = ["Wise", "Bank Transfer", "Cash", "Other"];

export function RecordPayoutForm({ venueId, venueName, suggestedAmountCents }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((suggestedAmountCents / 100).toFixed(2));
  const [method, setMethod] = useState("Wise");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError("Enter a valid amount");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId, amountCents, transferMethod: method, transferReference: reference, notes }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to record payout");
      setLoading(false);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg transition-colors"
      >
        Record Payout
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Record Payout — {venueName}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (USD)</label>
            <input
              type="number" step="0.01" min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Transfer method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
            >
              {TRANSFER_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Reference / confirmation # (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Wise transfer ID"
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Saving..." : "Save Payout"}
            </button>
            <button
              type="button" onClick={() => setOpen(false)}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
