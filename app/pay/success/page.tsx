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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-950 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 py-8 text-center">
          <p className="text-red-400">No session ID provided</p>
        </div>
      </div>
    );
  }

  // Fetch data inside try/catch, store in variables
  let payment;
  let error;

  try {
    // Retrieve the Checkout session from Stripe
    await stripe.checkout.sessions.retrieve(session_id);

    // Get payment details
    payment = await db.query.payments.findFirst({
      where: eq(payments.stripeCheckoutSessionId, session_id),
      with: {
        check: {
          with: {
            venue: true,
          },
        },
      },
    });
  } catch (err) {
    console.error("Error retrieving payment:", err);
    error = err as Error;
  }

  // Return JSX outside try/catch based on variables
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-950 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 py-8 text-center">
          <p className="text-red-400">Error retrieving payment details</p>
          <p className="text-purple-300 text-sm mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-950 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 py-8 text-center">
          <p className="text-red-400">Payment not found</p>
        </div>
      </div>
    );
  }

  const amount = payment.totalCents / 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-950 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-serif font-bold text-white mb-2">
            Payment Successful!
          </h1>
          
          <p className="text-purple-200 text-lg mb-6">
            Thank you for dining at {payment.check.venue.name}
          </p>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
            <p className="text-purple-100 mb-2">Amount Paid</p>
            <p className="text-4xl font-bold text-white">${amount.toFixed(2)}</p>
          </div>

          <p className="text-purple-300 text-sm">
            A receipt has been sent to your email
          </p>

          <div className="mt-8">
            <p className="text-purple-400 text-sm">
              You can close this window
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
