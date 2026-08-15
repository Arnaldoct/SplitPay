"use client";

/**
 * Stripe Connect status banner for the merchant dashboard.
 *
 * - Onboarding incomplete → persistent call-to-action to finish hosted KYC.
 * - Onboarding complete   → quick link to the Stripe Express Dashboard plus
 *   payout-timing expectations (first payout takes 7–14 business days).
 *
 * Only renders for venues on the stripe_connect payment model; aggregator
 * venues are paid manually and never see this.
 */

import { useEffect, useState } from "react";

interface StripeStatus {
  paymentModel: string;
  hasAccount: boolean;
  onboardingComplete: boolean;
}

export default function StripeStatusBanner() {
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // GET also re-syncs our flag with Stripe, so returning from the hosted
    // flow updates the banner without waiting for the account.updated webhook.
    const fetchStatus = async () => {
      const res = await fetch("/api/dashboard/stripe/onboard");
      if (res.ok) {
        setStatus(await res.json());
      }
    };
    fetchStatus();
  }, []);

  const startOnboarding = async () => {
    setIsRedirecting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/stripe/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start onboarding");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start onboarding");
      setIsRedirecting(false);
    }
  };

  const openStripeDashboard = async () => {
    setIsRedirecting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/stripe/login-link", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open Stripe dashboard");
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open Stripe dashboard");
    } finally {
      setIsRedirecting(false);
    }
  };

  if (!status || status.paymentModel !== "stripe_connect") return null;

  if (!status.onboardingComplete) {
    return (
      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 animate-rise">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-amber-900 mb-1">
              Connect your bank account to start receiving payments
            </h3>
            <p className="text-sm text-amber-800">
              Stripe handles identity verification and bank details securely — it
              takes about 5 minutes. Guests can&apos;t pay until this is done.
            </p>
            {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
          </div>
          <button
            onClick={startOnboarding}
            disabled={isRedirecting}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {isRedirecting ? "Redirecting…" : status.hasAccount ? "Resume setup" : "Set up payouts"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 animate-rise">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-900 mb-1">
            Payments are live — funds go straight to your bank
          </h3>
          <p className="text-sm text-emerald-800">
            Your first payout arrives 7–14 business days after your first payment
            (Stripe&apos;s standard hold for new accounts). After that, funds land
            daily, about 2 business days after each charge.
          </p>
          {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        </div>
        <button
          onClick={openStripeDashboard}
          disabled={isRedirecting}
          className="shrink-0 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-colors disabled:opacity-50"
        >
          View balance in Stripe ↗
        </button>
      </div>
    </div>
  );
}
