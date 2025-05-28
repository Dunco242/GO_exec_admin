import { NextResponse } from 'next/server';
import { connectImapAccount } from '../../../backend/services/imapService';
import '../../../backend/cron-jobs';
import { supabaseAdmin } from '../../../backend/utils/supabaseClient';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const imapConfig = await request.json();
    console.log('Received IMAP credentials in Next.js API route:', imapConfig);

    // Step 1: Get auth token from header or fallback to cookie
    let authToken = null;
    const authHeader = request.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      authToken = authHeader.replace('Bearer ', '');
    } else {
      const cookieStore = await cookies();
      authToken = cookieStore.get('sb-auth-token')?.value;
    }

    if (!authToken) {
      return NextResponse.json({ error: 'User not authenticated (no token).' }, { status: 401 });
    }

    // Step 2: Decode JWT (use payload = part[1])
    let userId = null;
    try {
      const base64Payload = authToken.split('.')[1];
      const jsonPayload = Buffer.from(base64Payload, 'base64').toString();
      const payload = JSON.parse(jsonPayload);
      userId = payload.sub;
    } catch (err) {
      console.error('JWT decoding error:', err);
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated (missing sub claim).' }, { status: 401 });
    }

    // Step 3: Try to connect to IMAP server
    const result = await connectImapAccount(imapConfig);

    if (result.status === 'connected') {
      const { error: upsertError } = await supabaseAdmin
        .from('user_settings')
        .upsert({
          user_id: userId,
          imap_password: imapConfig.password.trim(),
          imap_server: imapConfig.host,
          imap_port: imapConfig.port,
          main_email_address: imapConfig.username,
          imap_tls: imapConfig.tls
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Error saving IMAP settings:', upsertError);
        return NextResponse.json({ error: 'IMAP account connected, but failed to save settings.' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'IMAP account connected and settings saved successfully.',
        data: result
      }, { status: 200 });
    }

    return NextResponse.json({
      message: 'IMAP connection status unknown.',
      data: result
    }, { status: 200 });

  } catch (error) {
    console.error('Error connecting IMAP account:', error);
    return NextResponse.json({ error: error.message || 'Failed to connect IMAP account.' }, { status: 400 });
  }
}
