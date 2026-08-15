"use client";

import { SplitMode } from "../GuestPayFlow";

interface SplitSelectorProps {
  onSelectMode: (mode: SplitMode) => void;
  onBack: () => void;
}

const modes: Array<{
  mode: SplitMode;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: boolean;
}> = [
  {
    mode: "full",
    title: "Pay Full Check",
    description: "Pay the entire remaining balance",
    highlight: true,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    mode: "even",
    title: "Split Evenly",
    description: "Divide equally among 2-10 people",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    mode: "by_item",
    title: "Split by Item",
    description: "Pay only for what you ordered",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    mode: "custom",
    title: "Custom Amount",
    description: "Enter a specific amount to pay",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function SplitSelector({ onSelectMode, onBack }: SplitSelectorProps) {
  return (
    <div className="px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">How to Split?</h1>
        <p className="text-gray-500">Choose your payment method</p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {modes.map(({ mode, title, description, icon, highlight }) => (
          <button
            key={mode}
            onClick={() => onSelectMode(mode)}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all group"
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                highlight
                  ? "bg-violet-600 text-white"
                  : "bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white"
              } transition-colors`}
            >
              {icon}
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
            <svg
              className="w-5 h-5 text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Back Link */}
      <div className="mt-8 text-center">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 font-medium flex items-center gap-2 mx-auto"
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
