// app/api/fetch-full-email/route.js
import { NextResponse } from 'next/server';
import { fetchFullEmailContent } from '../../../backend/services/imapService'; // Import the new function
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { messageId } = await request.json(); // Expecting messageId from the frontend
    console.log(`Received request to fetch full email for messageId: ${messageId}`);

    const cookieStore = await cookies();
    const authToken = cookieStore.get('sb-auth-token')?.value;
    let userId = null;

    if (authToken) {
      try {
        userId = JSON.parse(Buffer.from(authToken.split('.')[0], 'base64').toString()).sub;
      } catch (error) {
        console.error('Error decoding user ID from token:', error);
        return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated.' }, { status: 401 });
    }

    // Call the new function in imapService to fetch the full email content
    const fullEmail = await fetchFullEmailContent(userId, messageId);

    if (!fullEmail) {
      return NextResponse.json({ error: 'Full email content not found.' }, { status: 404 });
    }

    return NextResponse.json({ email: fullEmail }, { status: 200 });

  } catch (error) {
    console.error('Error fetching full email:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch full email.' }, { status: 500 });
  }
}
