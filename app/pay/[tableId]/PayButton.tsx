"use client";

import { useState } from "react";

interface PayButtonProps {
  checkId: string;
  amount: number;
}

export function PayButton({ checkId, amount }: PayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

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
          splitMethod: "full",
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        console.error("No checkout URL received");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Payment error:", error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isLoading}
      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-4 rounded-xl shadow-lg transition-colors"
    >
      {isLoading ? "Processing..." : `Pay $${amount.toFixed(2)}`}
    </button>
  );
}
