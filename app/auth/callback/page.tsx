"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();

      // Get the code from URL (Supabase adds it as a hash fragment or query param)
      const code = searchParams.get("code");

      if (code) {
        // Exchange code for session - this works because the browser has the PKCE verifier
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("Auth callback error:", error);
          setError(error.message);
          return;
        }
      }

      // Check if we have a session now
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Link user to venue if needed, and check onboarding status
        try {
          const res = await fetch("/api/auth/link-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const data = await res.json();
          
          // Redirect based on onboarding status
          if (data.onboardingComplete === false) {
            router.replace("/onboard");
          } else {
            router.replace("/dashboard");
          }
        } catch (e) {
          console.error("Failed to link user:", e);
          // Default to dashboard, layout will redirect if needed
          router.replace("/dashboard");
        }
      } else {
        setError("No session found. Please try logging in again.");
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <a
              href="/dashboard/login"
              className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-colors"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Signing you in…</p>
          </div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
