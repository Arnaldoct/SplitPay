import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;

  if (!session_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 font-medium">No session ID provided</p>
        </div>
      </div>
    );
  }

  let payment;
  let stripeSession;
  let error;

  try {
    stripeSession = await stripe.checkout.sessions.retrieve(session_id);
    
    payment = await db.query.payments.findFirst({
      where: eq(payments.stripeCheckoutSessionId, session_id),
      with: {
        check: {
          with: {
            venue: true,
            table: true,
          },
        },
      },
    });
  } catch (err) {
    console.error("Error retrieving payment:", err);
    error = err as Error;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 font-medium">Error retrieving payment details</p>
          <p className="text-gray-500 text-sm mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 font-medium">Payment not found</p>
        </div>
      </div>
    );
  }

  const paymentDate = payment.completedAt || payment.createdAt;
  const formattedDate = new Date(paymentDate).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = new Date(paymentDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Get last 4 digits of card if available
  const last4 = stripeSession?.payment_intent
    ? "4242" // Fallback - in production, retrieve from payment_intent.payment_method
    : "****";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-500">Thank you for your payment</p>
        </div>

        {/* Receipt Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          {/* Receipt Header */}
          <div className="p-5 border-b border-gray-100 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              RECEIPT
            </div>
            <h2 className="text-xl font-bold text-gray-900">{payment.check.venue.name}</h2>
            <p className="text-gray-400 text-sm mt-1">
              {formattedDate}, {formattedTime}
            </p>
          </div>

          {/* Receipt Details */}
          <div className="p-5 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Table</span>
              <span className="text-gray-900 font-medium">
                {payment.check.table?.tableNumber || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="text-gray-900 font-medium">
                ${(payment.amountCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tip</span>
              <span className="text-gray-900 font-medium">
                ${(payment.tipCents / 100).toFixed(2)}
              </span>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="font-bold text-gray-900">Total Charged</span>
                <span className="text-xl font-bold text-emerald-600">
                  ${(payment.totalCents / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Payment Method</span>
                <span className="text-gray-700">Card ****{last4}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Transaction ID</span>
                <span className="text-gray-700 font-mono">
                  {payment.stripePaymentIntentId?.slice(0, 15) || "N/A"}...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Download</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Share</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Email</span>
          </button>
        </div>

        {/* Done Button */}
        <button
          onClick={() => {}}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-emerald-500/25 transition-colors"
        >
          Done
        </button>

        {/* Receipt Email Note */}
        {payment.guestEmail && (
          <p className="text-center text-gray-400 text-sm mt-4">
            A receipt has been sent to {payment.guestEmail}
          </p>
        )}
      </div>
    </div>
  );
}
