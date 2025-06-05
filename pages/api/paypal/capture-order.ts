// pages/api/paypal/capture-order.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdminClient'; // Admin client to bypass RLS
import { createClient } from '@supabase/supabase-js';

type Data = {
  message?: string;
  error?: string;
  debug?: any;
  redirectUrl?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { orderId, invoiceId } = req.body;
  const userId = req.headers['x-user-id'] as string;

  if (!orderId || !invoiceId || !userId) {
    return res.status(400).json({ error: 'Order ID, Invoice ID, and User ID are required.' });
  }

  try {
    // 1. Fetch PayPal credentials using admin client
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('paypal_client_id, paypal_client_secret')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings?.paypal_client_id || !settings?.paypal_client_secret) {
      console.error('Failed to retrieve PayPal credentials:', settingsError?.message);
      return res.status(401).json({
        error: 'PayPal credentials not configured for this user.',
        debug: settingsError?.message,
      });
    }

    const PAYPAL_CLIENT_ID = settings.paypal_client_id;
    const PAYPAL_CLIENT_SECRET = settings.paypal_client_secret;
    const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // 2. Get PayPal Access Token
    const authRes = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!authRes.ok) {
      const errorText = await authRes.text();
      console.error('PayPal Auth Error:', authRes.status, errorText);
      return res.status(authRes.status).json({
        error: 'Failed to authenticate with PayPal.',
        debug: errorText,
      });
    }

    const { access_token } = await authRes.json();

    // 3. Capture PayPal Order
    const captureRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
        'PayPal-Request-Id': `CAP_${invoiceId}_${Date.now()}`, // Optional idempotency key
      },
      body: JSON.stringify({}),
    });

    if (!captureRes.ok) {
      const errorData = await captureRes.json();
      console.error('PayPal Capture Error:', captureRes.status, errorData);
      return res.status(captureRes.status).json({
        error: 'Failed to capture PayPal order.',
        debug: errorData,
      });
    }

    const captureData = await captureRes.json();
    console.log('PayPal Order Captured:', captureData.id, 'Status:', captureData.status);

    // 4. Log transaction in Supabase
    const payer = captureData.payer;
    const purchaseUnit = captureData.purchase_units?.[0];
    const payment = purchaseUnit?.payments?.captures?.[0];

    if (!payment || payment.status !== 'COMPLETED') {
      return res.status(400).json({
        error: `Payment status is ${payment?.status || 'unknown'}, but expected COMPLETED.`,
      });
    }

    const amount = parseFloat(payment.amount?.value);
    const currency = payment.amount?.currency_code || 'USD';

    const { error: insertError } = await supabaseAdmin
      .from('paypal_transactions')
      .insert({
        user_id: userId,
        invoice_id: invoiceId,
        paypal_transaction_id: payment.id,
        amount,
        currency,
        status: payment.status,
        payment_method: 'paypal',
        payer_id: payer?.payer_id,
        payer_email: payer?.email_address,
        metadata: captureData,
      });

    if (insertError) {
      console.error('Error inserting PayPal transaction:', insertError.message);
      return res.status(500).json({
        error: 'Payment successful, but failed to record transaction.',
        debug: insertError.message,
      });
    }

    // 5. Update invoice status to "paid"
    const { error: updateInvoiceError } = await supabaseAdmin
      .from('invoices')
      .update({
        status: 'paid',
        paid_amount: amount,
        payment_date: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('user_id', userId);

    if (updateInvoiceError) {
      console.error('Error updating invoice status:', updateInvoiceError.message);
      return res.status(500).json({
        error: 'Payment processed but failed to update invoice status.',
        debug: updateInvoiceError.message,
      });
    }

    // 6. Success response
    return res.status(200).json({
      message: 'Payment successfully processed and recorded.',
      redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/invoices?payment_status=success&invoice_id=${invoiceId}`,
    });

  } catch (error: any) {
    console.error('Server error during PayPal order capture:', error.message);
    return res.status(500).json({ error: 'Internal server error.', debug: error.message });
  }
}
