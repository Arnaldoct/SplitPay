/**
 * Email utilities using Resend
 * Sends transactional emails (receipts, magic links, etc.)
 */

import { Resend } from "resend";

// Initialize Resend (will be undefined if API key not set)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface ReceiptData {
  guestEmail: string;
  venueName: string;
  checkNumber: string;
  tableNumber: string;
  amountCents: number;
  tipCents: number;
  totalCents: number;
  splitMethod: string;
  paymentDate: Date;
}

export async function sendReceipt(data: ReceiptData) {
  const {
    guestEmail,
    venueName,
    checkNumber,
    tableNumber,
    amountCents,
    tipCents,
    totalCents,
    splitMethod,
    paymentDate,
  } = data;

  const amount = (amountCents / 100).toFixed(2);
  const tip = (tipCents / 100).toFixed(2);
  const total = (totalCents / 100).toFixed(2);

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Receipt - ${venueName}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6B46C1 0%, #553C9A 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-family: Georgia, serif;">SplitPay</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Payment Receipt</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px;">Thank you for dining at ${venueName}!</h2>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Check #</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${checkNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Table</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${tableNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Split Method</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; text-transform: capitalize;">${splitMethod.replace("_", " ")}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Date</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${paymentDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}</td>
              </tr>
            </table>
          </div>

          <div style="margin: 30px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Payment Amount</td>
                <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">$${amount}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Tip</td>
                <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid #e5e7eb;">$${tip}</td>
              </tr>
              <tr>
                <td style="padding: 20px 0 12px; font-size: 18px; font-weight: 700;">Total Paid</td>
                <td style="padding: 20px 0 12px; text-align: right; font-size: 24px; font-weight: 700; color: #6B46C1;">$${total}</td>
              </tr>
            </table>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #166534; font-weight: 600;">✓ Payment successful</p>
            <p style="margin: 8px 0 0; color: #166534; font-size: 14px;">Your payment has been processed securely via Stripe.</p>
          </div>

          <div style="margin: 30px 0; padding-top: 30px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0 0 10px;">Questions about your payment?</p>
            <p style="margin: 0;">Contact ${venueName} directly.</p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 5px 0;">Powered by SplitPay</p>
          <p style="margin: 5px 0;">This is an automated receipt. Please do not reply to this email.</p>
        </div>
      </body>
    </html>
  `;

  // If Resend is not configured, log the email instead
  if (!resend) {
    console.log("📧 Receipt Email (Resend not configured):");
    console.log(`To: ${guestEmail}`);
    console.log(`Subject: Payment Receipt - ${venueName}`);
    console.log(`Total: $${total}`);
    return { success: true, mode: "console" };
  }

  try {
    await resend.emails.send({
      from: "SplitPay <receipts@splitpayusa.com>",
      to: guestEmail,
      subject: `Payment Receipt - ${venueName}`,
      html: emailHtml,
    });

    console.log(`✅ Receipt sent to ${guestEmail}`);
    return { success: true, mode: "sent" };
  } catch (error) {
    console.error("Failed to send receipt:", error);
    return { success: false, error };
  }
}
