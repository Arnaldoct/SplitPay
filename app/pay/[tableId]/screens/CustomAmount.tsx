"use client";

import { useState } from "react";

interface CustomAmountProps {
  remainingCents: number;
  onConfirm: (amountCents: number) => void;
  onBack: () => void;
}

export function CustomAmount({ remainingCents, onConfirm, onBack }: CustomAmountProps) {
  const [amount, setAmount] = useState("");

  const quickOptions = [
    { label: "25%", value: Math.round(remainingCents * 0.25) },
    { label: "50%", value: Math.round(remainingCents * 0.5) },
    { label: "75%", value: Math.round(remainingCents * 0.75) },
    { label: "Full", value: remainingCents },
  ];

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const isValid = amountCents > 0 && amountCents <= remainingCents;

  const handleQuickSelect = (cents: number) => {
    setAmount((cents / 100).toFixed(2));
  };

  return (
    <div className="px-4 py-8">
      {/* Header Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-violet-600 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Custom Amount</h1>
        <p className="text-emerald-600 font-medium">
          Remaining: ${(remainingCents / 100).toFixed(2)}
        </p>
      </div>

      {/* Amount Input */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl text-gray-400 font-light">$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max={remainingCents / 100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="text-4xl font-bold text-gray-900 w-40 text-center outline-none placeholder:text-gray-300"
          />
        </div>

        {/* Quick Select Buttons */}
        <div className="grid grid-cols-4 gap-2 mt-6">
          {quickOptions.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => handleQuickSelect(value)}
              className={`py-3 px-4 rounded-xl font-medium transition-all ${
                amountCents === value
                  ? "bg-violet-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Validation Message */}
      {parseFloat(amount || "0") > remainingCents / 100 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm text-center">
            Amount exceeds remaining balance
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-white border border-gray-300 text-violet-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => onConfirm(amountCents)}
          disabled={!isValid}
          className="flex-1 py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold rounded-2xl transition-colors disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
