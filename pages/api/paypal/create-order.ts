// pages/api/paypal/create-order.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdminClient'; // Use admin client to bypass RLS

type Data = {
  orderId?: string;
  error?: string;
  debug?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { invoiceId } = req.body;
  const userId = req.headers['x-user-id'] as string;

  if (!invoiceId || !userId) {
    return res.status(400).json({ error: 'Invoice ID and User ID are required.' });
  }

  try {
    // ✅ Using supabaseAdmin to bypass RLS and fetch settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('paypal_client_id, paypal_client_secret')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings?.paypal_client_id || !settings?.paypal_client_secret) {
      console.error('Failed to retrieve PayPal credentials:', settingsError?.message);
      return res.status(401).json({ error: 'PayPal credentials not configured for this user.' });
    }

    const PAYPAL_CLIENT_ID = settings.paypal_client_id;
    const PAYPAL_CLIENT_SECRET = settings.paypal_client_secret;

    const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // Fetch invoice using supabaseAdmin too (to be consistent)
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('total_amount, currency, status, invoice_number')
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .single();

    if (invoiceError || !invoice) {
      console.error('Failed to retrieve invoice:', invoiceError?.message);
      return res.status(404).json({ error: 'Invoice not found or unauthorized.' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid.' });
    }

    const invoiceTotalAmount = invoice.total_amount?.toFixed(2);
    const invoiceCurrency = invoice.currency || 'USD';

    if (!invoiceTotalAmount) {
      return res.status(400).json({ error: 'Invoice total amount is missing.' });
    }

    // Get PayPal Access Token
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
      return res.status(authRes.status).json({ error: 'Failed to authenticate with PayPal.', debug: errorText });
    }

    const { access_token } = await authRes.json();

    // Create PayPal Order
    const createOrderRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
        'PayPal-Request-Id': `INV_${invoiceId}_${Date.now()}`, // Idempotency key
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: invoiceId,
            amount: {
              currency_code: invoiceCurrency,
              value: invoiceTotalAmount,
            },
            description: `Payment for Invoice #${invoice.invoice_number || invoiceId}`,
          },
        ],
        application_context: {
          return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/invoices?payment_status=success&invoice_id=${invoiceId}`,
          cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/invoices?payment_status=cancelled&invoice_id=${invoiceId}`,
          brand_name: 'Your App Name',
          locale: 'en-US',
          landing_page: 'BILLING',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!createOrderRes.ok) {
      const errorData = await createOrderRes.json();
      console.error('PayPal Create Order Error:', createOrderRes.status, errorData);
      return res.status(createOrderRes.status).json({ error: 'Failed to create PayPal order.', debug: errorData });
    }

    const orderData = await createOrderRes.json();
    console.log('PayPal Order Created:', orderData.id);

    return res.status(200).json({ orderId: orderData.id });
  } catch (error: any) {
    console.error('Server error during PayPal order creation:', error.message);
    return res.status(500).json({ error: 'Internal server error.', debug: error.message });
  }
}
