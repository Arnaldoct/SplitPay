"use client";

import { useState } from "react";
import { CheckItem } from "../GuestPayFlow";

interface SplitByItemProps {
  items: CheckItem[];
  taxCents: number;
  subtotalCents: number;
  onConfirm: (amountCents: number, itemIds: string[]) => void;
  onBack: () => void;
}

export function SplitByItem({ items, taxCents, subtotalCents, onConfirm, onBack }: SplitByItemProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Calculate selected items subtotal
  const selectedSubtotal = items
    .filter((item) => selectedIds.has(item.id))
    .reduce((sum, item) => sum + (item.totalCents - item.claimedCents), 0);

  // Calculate proportional tax
  const taxRate = subtotalCents > 0 ? taxCents / subtotalCents : 0;
  const proportionalTax = Math.round(selectedSubtotal * taxRate);
  const totalAmount = selectedSubtotal + proportionalTax;

  const isValid = selectedIds.size > 0;

  return (
    <div className="px-4 py-8">
      {/* Header Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-violet-600 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Split by Item</h1>
        <p className="text-gray-500">Select what you ordered</p>
      </div>

      {/* Items List */}
      <div className="space-y-3 mb-6">
        {items.map((item) => {
          const remaining = item.totalCents - item.claimedCents;
          const isFullyClaimed = remaining <= 0;
          const isSelected = selectedIds.has(item.id);

          return (
            <button
              key={item.id}
              onClick={() => !isFullyClaimed && toggleItem(item.id)}
              disabled={isFullyClaimed}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                isFullyClaimed
                  ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                  : isSelected
                  ? "border-violet-500 bg-violet-50"
                  : "border-gray-200 bg-white hover:border-violet-300"
              }`}
            >
              {/* Checkbox */}
              <div
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-violet-600 border-violet-600"
                    : "border-gray-300 bg-white"
                }`}
              >
                {isSelected && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Item Info */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  {item.quantity > 1 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
                {isFullyClaimed && (
                  <span className="text-xs text-gray-400">Already claimed</span>
                )}
              </div>

              {/* Price */}
              <span className="font-semibold text-gray-900">
                ${(remaining / 100).toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 mb-8">
        <div className="flex justify-between text-gray-600 mb-2">
          <span className="text-violet-600 font-medium">Selected Items ({selectedIds.size})</span>
          <span>${(selectedSubtotal / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-500 mb-3">
          <span>Tax</span>
          <span>${(proportionalTax / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between pt-3 border-t border-gray-200">
          <span className="font-bold text-gray-900">Your Total</span>
          <div className="text-right">
            <span className="text-2xl font-bold text-violet-600">
              ${(totalAmount / 100).toFixed(2)}
            </span>
            <p className="text-gray-400 text-xs">Before tip</p>
          </div>
        </div>
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
          onClick={() => onConfirm(totalAmount, Array.from(selectedIds))}
          disabled={!isValid}
          className="flex-1 py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold rounded-2xl transition-colors disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
