"use client";

import { useState } from "react";
import { SplitMode } from "../GuestPayFlow";

interface TipSelectionProps {
  checkId: string;
  amountCents: number;
  splitMode: SplitMode;
  selectedItemIds: string[];
  onBack: () => void;
}

const tipOptions = [
  { percent: 10, emoji: "😊", label: "Standard" },
  { percent: 15, emoji: "🤩", label: "Recommended", recommended: true },
  { percent: 20, emoji: "🤯", label: "Generous" },
];

export function TipSelection({
  checkId,
  amountCents,
  splitMode,
  selectedItemIds,
  onBack,
}: TipSelectionProps) {
  const [selectedPercent, setSelectedPercent] = useState<number | null>(15);
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateTipCents = (): number => {
    if (showCustomTip) {
      return Math.round(parseFloat(customTipAmount || "0") * 100);
    }
    if (selectedPercent === null) return 0;
    return Math.round((amountCents * selectedPercent) / 100);
  };

  const tipCents = calculateTipCents();
  const totalCents = amountCents + tipCents;

  const handleSelectTip = (percent: number) => {
    setSelectedPercent(percent);
    setShowCustomTip(false);
    setCustomTipAmount("");
  };

  const handleCustomTip = () => {
    setShowCustomTip(true);
    setSelectedPercent(null);
  };

  const handleNoTip = () => {
    setSelectedPercent(0);
    setShowCustomTip(false);
    setCustomTipAmount("");
  };

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkId,
          splitMethod: splitMode,
          amountCents,
          tipCents,
          selectedItems: splitMode === "by_item" ? selectedItemIds : undefined,
          guestEmail: guestEmail || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Payment failed");
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-gray-500 mb-2">Show your appreciation for great service</p>
      </div>

      {/* Subtotal Banner */}
      <div className="bg-gradient-to-r from-violet-500 to-violet-600 rounded-2xl p-5 mb-6 text-center">
        <p className="text-violet-200 text-sm mb-1">Your Subtotal</p>
        <p className="text-4xl font-bold text-white">${(amountCents / 100).toFixed(2)}</p>
      </div>

      {/* Tip Options */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {tipOptions.map(({ percent, emoji, label, recommended }) => {
          const tipAmount = Math.round((amountCents * percent) / 100);
          const isSelected = selectedPercent === percent && !showCustomTip;

          return (
            <button
              key={percent}
              onClick={() => handleSelectTip(percent)}
              className={`relative p-4 rounded-2xl border-2 transition-all ${
                isSelected
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "bg-white border-gray-200 hover:border-violet-300"
              }`}
            >
              {recommended && (
                <span className="absolute -top-2 -right-2 text-lg">✨</span>
              )}
              <div className="text-2xl mb-1">{emoji}</div>
              <div className={`font-bold text-lg ${isSelected ? "text-white" : "text-gray-900"}`}>
                {percent}%
              </div>
              <div className={`text-xs ${isSelected ? "text-violet-200" : "text-gray-500"}`}>
                {recommended ? "⭐ Recommended" : label}
              </div>
              <div className={`text-sm font-semibold mt-1 ${isSelected ? "text-white" : "text-violet-600"}`}>
                ${(tipAmount / 100).toFixed(2)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Tip */}
      <button
        onClick={handleCustomTip}
        className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 transition-all mb-6 ${
          showCustomTip
            ? "bg-violet-50 border-violet-500"
            : "bg-white border-gray-200 hover:border-violet-300"
        }`}
      >
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <span className="text-lg">✨</span>
        </div>
        <div className="text-left flex-1">
          <div className="font-semibold text-gray-900">Custom Tip</div>
          <div className="text-sm text-gray-500">Enter your own amount</div>
        </div>
      </button>

      {showCustomTip && (
        <div className="mb-6 p-4 bg-gray-50 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl text-gray-400">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={customTipAmount}
              onChange={(e) => setCustomTipAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="flex-1 text-2xl font-bold text-gray-900 bg-transparent outline-none placeholder:text-gray-300"
            />
          </div>
        </div>
      )}

      {/* Email for Receipt */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email for receipt (optional)
        </label>
        <input
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <div className="flex justify-between text-gray-600 mb-2">
          <span>Subtotal</span>
          <span>${(amountCents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-emerald-600 mb-3">
          <span>Tip</span>
          <span>${(tipCents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between pt-3 border-t border-gray-200">
          <span className="font-bold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-violet-600">
            ${(totalCents / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Pay Button */}
      <button
        onClick={handlePayment}
        disabled={isLoading}
        className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-violet-600/25 transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (
          "Continue to Payment"
        )}
      </button>

      {/* No Tip / Back */}
      <div className="mt-4 flex flex-col items-center gap-3">
        {selectedPercent !== 0 && !showCustomTip && (
          <button
            onClick={handleNoTip}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            No tip this time
          </button>
        )}
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>
    </div>
  );
}
