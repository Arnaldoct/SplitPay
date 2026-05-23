"use client";

import { useState } from "react";
import { PayButton } from "./PayButton";

interface SplitModeSelectorProps {
  checkId: string;
  totalCents: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    totalCents: number;
    claimedCents: number;
  }>;
}

type SplitMode = "full" | "even" | "by_item" | "custom";

export function SplitModeSelector({
  checkId,
  totalCents,
  items,
}: SplitModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<SplitMode>("full");
  const [numPeople, setNumPeople] = useState(2);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const total = totalCents / 100;
  const remainingTotal = items.reduce(
    (sum, item) => sum + (item.totalCents - item.claimedCents),
    0
  ) / 100;

  // Calculate amount based on split mode
  const calculateAmount = (): number => {
    switch (selectedMode) {
      case "full":
        return total;
      case "even":
        return total / numPeople;
      case "by_item":
        return (
          Array.from(selectedItems).reduce((sum, itemId) => {
            const item = items.find((i) => i.id === itemId);
            return sum + (item ? item.totalCents - item.claimedCents : 0);
          }, 0) / 100
        );
      case "custom":
        return parseFloat(customAmount) || 0;
      default:
        return 0;
    }
  };

  const amount = calculateAmount();
  const isValid = amount > 0 && amount <= remainingTotal;

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  return (
    <div className="space-y-6">
      {/* Split Mode Tabs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSelectedMode("full")}
          className={`py-3 px-4 rounded-lg font-medium transition-colors ${
            selectedMode === "full"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Pay Full
        </button>
        <button
          onClick={() => setSelectedMode("even")}
          className={`py-3 px-4 rounded-lg font-medium transition-colors ${
            selectedMode === "even"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Split Evenly
        </button>
        <button
          onClick={() => setSelectedMode("by_item")}
          className={`py-3 px-4 rounded-lg font-medium transition-colors ${
            selectedMode === "by_item"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Split by Item
        </button>
        <button
          onClick={() => setSelectedMode("custom")}
          className={`py-3 px-4 rounded-lg font-medium transition-colors ${
            selectedMode === "custom"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Custom Amount
        </button>
      </div>

      {/* Mode-specific UI */}
      {selectedMode === "full" && (
        <div className="text-center py-4">
          <p className="text-gray-600">Pay the full check amount</p>
        </div>
      )}

      {selectedMode === "even" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Number of people splitting
          </label>
          <input
            type="number"
            min="2"
            max="20"
            value={numPeople}
            onChange={(e) => setNumPeople(parseInt(e.target.value) || 2)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-600">
            Each person pays: ${amount.toFixed(2)}
          </p>
        </div>
      )}

      {selectedMode === "by_item" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Select your items</p>
          <div className="space-y-2">
            {items.map((item) => {
              const remaining = item.totalCents - item.claimedCents;
              const isFullyClaimed = remaining === 0;
              const isSelected = selectedItems.has(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => !isFullyClaimed && toggleItem(item.id)}
                  disabled={isFullyClaimed}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    isFullyClaimed
                      ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-200 hover:border-purple-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected
                        ? "bg-purple-600 border-purple-600"
                        : "border-gray-300"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.quantity > 1 && (
                      <p className="text-sm text-gray-500">×{item.quantity}</p>
                    )}
                    {isFullyClaimed && (
                      <p className="text-xs text-gray-500">Already claimed</p>
                    )}
                  </div>
                  <p className="font-medium text-gray-900">
                    ${(remaining / 100).toFixed(2)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedMode === "custom" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Amount to pay
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingTotal}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
            />
          </div>
          <p className="text-sm text-gray-600">
            Remaining on check: ${remainingTotal.toFixed(2)}
          </p>
        </div>
      )}

      {/* Pay Button */}
      <div className="pt-4">
        {isValid ? (
          <PayButton 
            checkId={checkId} 
            amount={amount}
            splitMethod={selectedMode}
            selectedItems={selectedMode === "by_item" ? Array.from(selectedItems) : undefined}
          />
        ) : (
          <button
            disabled
            className="w-full bg-gray-300 text-gray-500 font-semibold py-4 rounded-xl cursor-not-allowed"
          >
            {amount === 0 ? "Select items or enter amount" : "Invalid amount"}
          </button>
        )}
      </div>
    </div>
  );
}
