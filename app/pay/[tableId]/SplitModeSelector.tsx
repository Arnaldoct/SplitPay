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
  const [selectedTipPercent, setSelectedTipPercent] = useState<number | null>(18);
  const [customTip, setCustomTip] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const total = totalCents / 100;
  const tipSuggestions = [15, 18, 20, 22, 0]; // 0 = No tip
  
  // Calculate remaining items (for split by item validation)
  const remainingItemsTotal = items.reduce(
    (sum, item) => sum + (item.totalCents - item.claimedCents),
    0
  ) / 100;
  
  // For "Pay Full", use the full check total
  // For split methods, use remaining items total
  const maxAmount = selectedMode === "full" ? total : remainingItemsTotal;

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
  const isValid = amount > 0 && amount <= maxAmount;

  // Calculate tip
  const calculateTip = (): number => {
    if (selectedTipPercent === null) {
      // Custom tip
      return parseFloat(customTip) || 0;
    }
    return (amount * selectedTipPercent) / 100;
  };

  const tipAmount = calculateTip();
  const totalWithTip = amount + tipAmount;

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
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-center text-gray-700 mb-2">
            You'll pay the full check amount
          </p>
          <p className="text-center text-2xl font-bold text-purple-600">
            ${total.toFixed(2)}
          </p>
          <p className="text-center text-sm text-gray-500 mt-1">
            (before tip)
          </p>
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
              max={maxAmount}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
            />
          </div>
          <p className="text-sm text-gray-600">
            Maximum amount: ${maxAmount.toFixed(2)}
          </p>
        </div>
      )}

      {/* Email for Receipt (Optional) */}
      {isValid && amount > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email for receipt (optional)
          </label>
          <input
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Tip Selection */}
      {isValid && amount > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Add a tip</h3>
          
          {/* Tip Buttons */}
          <div className="grid grid-cols-5 gap-2">
            {tipSuggestions.map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => {
                  setSelectedTipPercent(percent);
                  setCustomTip("");
                }}
                className={`py-3 px-2 rounded-lg font-medium transition-colors text-sm ${
                  selectedTipPercent === percent
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {percent === 0 ? "No Tip" : `${percent}%`}
              </button>
            ))}
          </div>

          {/* Custom Tip */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setSelectedTipPercent(null);
                setCustomTip("");
              }}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                selectedTipPercent === null
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {selectedTipPercent === null ? "✓ Custom Tip" : "Custom Tip"}
            </button>
            {selectedTipPercent === null && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Tip Amount Display */}
          {tipAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tip amount</span>
              <span className="font-medium">${tipAmount.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Pay Button */}
      <div className="pt-4">
        {isValid ? (
          <>
            {/* Total Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-gray-700">
                <span>Your portion</span>
                <span className="font-medium">${amount.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Tip</span>
                  <span className="font-medium">${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-300">
                <span>Total to pay</span>
                <span>${totalWithTip.toFixed(2)}</span>
              </div>
            </div>
            
            <PayButton 
              checkId={checkId} 
              amount={amount}
              tipAmount={tipAmount}
              splitMethod={selectedMode}
              selectedItems={selectedMode === "by_item" ? Array.from(selectedItems) : undefined}
              guestEmail={guestEmail}
            />
          </>
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
