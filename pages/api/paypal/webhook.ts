// pages/api/paypal/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type WebhookEvent = {
  id: string;
  event_version: string;
  create_time: string;
  resource: {
    id: string;
    status: string;
    invoice_id?: string;
    amount?: {
      value: string;
      currency_code: string;
    };
    payer?: {
      email_address: string;
      payer_id: string;
    };
  };
  event_type: string;
  resource_type: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ received: boolean; success?: boolean; error?: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ received: false, error: 'Method Not Allowed' });
  }

  const event = req.body as WebhookEvent;

  // Verify that this is a real event from PayPal
  // You'd normally verify with their API or signature validation (optional for dev)

  console.log("Received webhook:", event.event_type, event.resource.status);

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const captureId = event.resource.id;
    const invoiceId = event.resource.invoice_id;
    const amount = parseFloat(event.resource.amount?.value ?? '0');
    const currency = event.resource.amount?.currency_code || 'USD';
    const userId = event.resource.payer?.payer_id || null;

    // Update your Supabase DB using Admin client
    try {
      const { error: insertError } = await supabaseAdmin
        .from('paypal_transactions')
        .insert({
          paypal_transaction_id: captureId,
          user_id: userId,
          invoice_id: invoiceId,
          amount,
          currency,
          status: 'COMPLETED',
          metadata: event,
        });

      if (insertError) throw insertError;

      const { error: updateInvoiceError } = await supabaseAdmin
        .from('invoices')
        .update({
          status: 'paid',
          paid_amount: amount,
          payment_date: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (updateInvoiceError) throw updateInvoiceError;

      return res.status(200).json({ received: true, success: true });
    } catch (error: any) {
      console.error("Webhook DB Error:", error.message);
      return res.status(500).json({ received: true, success: false, error: error.message });
    }
  }

  // Acknowledge receipt of other events
  return res.status(200).json({ received: true });
}
