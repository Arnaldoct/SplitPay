"use client";

import { useState } from "react";

interface SplitEvenlyProps {
  totalCents: number;
  onConfirm: (amountCents: number) => void;
  onBack: () => void;
}

export function SplitEvenly({ totalCents, onConfirm, onBack }: SplitEvenlyProps) {
  const [numPeople, setNumPeople] = useState(2);
  const minPeople = 2;
  const maxPeople = 10;

  const shareAmount = Math.ceil(totalCents / numPeople);

  const handleDecrease = () => {
    if (numPeople > minPeople) {
      setNumPeople(numPeople - 1);
    }
  };

  const handleIncrease = () => {
    if (numPeople < maxPeople) {
      setNumPeople(numPeople + 1);
    }
  };

  return (
    <div className="px-4 py-8">
      {/* Header Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-violet-600 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Split Evenly</h1>
        <p className="text-gray-500">Divide the check equally</p>
      </div>

      {/* People Selector */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="text-center mb-6">
          <span className="text-6xl font-bold text-violet-600">{numPeople}</span>
          <p className="text-violet-600 font-medium mt-2">People</p>
        </div>

        {/* Slider Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleDecrease}
            disabled={numPeople <= minPeople}
            className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:border-violet-500 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>

          {/* Slider Track */}
          <div className="flex-1 relative h-2">
            <div className="absolute inset-0 bg-gray-200 rounded-full" />
            <div
              className="absolute inset-y-0 left-0 bg-violet-600 rounded-full transition-all"
              style={{ width: `${((numPeople - minPeople) / (maxPeople - minPeople)) * 100}%` }}
            />
            <input
              type="range"
              min={minPeople}
              max={maxPeople}
              value={numPeople}
              onChange={(e) => setNumPeople(parseInt(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>

          <button
            onClick={handleIncrease}
            disabled={numPeople >= maxPeople}
            className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:border-violet-500 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Your Share */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-8 text-center">
        <p className="text-emerald-600 font-medium mb-1">Your Share</p>
        <p className="text-4xl font-bold text-violet-600">
          ${(shareAmount / 100).toFixed(2)}
        </p>
        <p className="text-gray-400 text-sm mt-2">Before tip</p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-white border border-gray-300 text-violet-600 font-semibold rounded-2xl hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => onConfirm(shareAmount)}
          className="flex-1 py-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-2xl transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
