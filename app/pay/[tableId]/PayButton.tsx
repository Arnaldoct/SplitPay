"use client";

import { useState } from "react";

interface PayButtonProps {
  checkId: string;
  amount: number;
  tipAmount: number;
  splitMethod: string;
  selectedItems?: string[];
  guestEmail?: string;
}

export function PayButton({ checkId, amount, tipAmount, splitMethod, selectedItems, guestEmail }: PayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const totalWithTip = amount + tipAmount;

  const handlePayment = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkId,
          splitMethod,
          amountCents: Math.round(amount * 100),
          tipCents: Math.round(tipAmount * 100),
          selectedItems,
          guestEmail: guestEmail || undefined,
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
        setIsLoading(false);
      } else {
        console.error("No checkout URL received");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isLoading}
      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-4 rounded-xl shadow-lg transition-colors"
    >
      {isLoading ? "Processing..." : `Pay $${totalWithTip.toFixed(2)}`}
    </button>
  );
}
