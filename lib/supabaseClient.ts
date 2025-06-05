// lib/supabaseClient.ts

// This client is for use in "use client" components (client-side).
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Ensure environment variables are set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key environment variables are not set.');
}

// Export the client for client-side components
// Any "use client" file that needs Supabase should import 'supabase' from here.
export const supabase = createClientComponentClient({
  supabaseUrl,
  supabaseKey: supabaseAnonKey,
});
