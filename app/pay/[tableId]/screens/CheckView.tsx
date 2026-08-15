"use client";

import { CheckItem } from "../GuestPayFlow";

interface CheckViewProps {
  venueName: string;
  tableNumber: string;
  checkNumber: string;
  items: CheckItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  openedAt: string;
  onPayCheck: () => void;
}

export function CheckView({
  venueName,
  tableNumber,
  items,
  subtotalCents,
  taxCents,
  totalCents,
  paidCents,
  openedAt,
  onPayCheck,
}: CheckViewProps) {
  const remainingCents = totalCents - paidCents;
  const openedTime = new Date(openedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="px-4 py-6">
      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo Icon */}
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{venueName}</h1>
                <p className="text-sm text-violet-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Table {tableNumber}
                </p>
              </div>
            </div>
            {/* Status Badge */}
            <span className="px-3 py-1 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
              {paidCents > 0 ? "paying" : "open"}
            </span>
          </div>

          {/* Server info - placeholder for now */}
          <div className="mt-3 flex items-center gap-2 text-gray-500 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Server: Your Server</span>
          </div>
        </div>

        {/* Items List */}
        <div className="p-5 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-900 font-medium">{item.name}</span>
                {item.quantity > 1 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md">
                    ×{item.quantity}
                  </span>
                )}
              </div>
              <span className="text-gray-900 font-medium">
                ${(item.totalCents / 100).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-gray-200" />

        {/* Totals */}
        <div className="p-5 space-y-2">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>${(subtotalCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span>${(taxCents / 100).toFixed(2)}</span>
          </div>
          {paidCents > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Already Paid</span>
              <span>−${(paidCents / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span className="text-violet-600">
              ${(remainingCents / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Opened Time */}
        <div className="px-5 pb-5">
          <p className="text-center text-gray-400 text-sm flex items-center justify-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Opened {openedTime}
          </p>
        </div>
      </div>

      {/* Pay Button */}
      <div className="mt-6 px-1">
        <button
          onClick={onPayCheck}
          className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-violet-600/25 transition-colors"
        >
          Pay Your Check
        </button>
      </div>
    </div>
  );
}
