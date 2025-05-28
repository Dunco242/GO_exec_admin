// scripts/generate-previews.js
import { supabase } from '@/lib/supabaseClient';
import { extractPreview } from '@/lib/email-utils';

async function migratePreviews() {
  const BATCH_SIZE = 100;
  let processed = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: emails, error } = await supabase
      .from('emails')
      .select('id, content')
      .is('preview', null)
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (emails.length === 0) {
      hasMore = false;
      continue;
    }

    const updates = emails.map(email => ({
      id: email.id,
      preview: extractPreview(email.content),
      updated_at: new Date().toISOString()
    }));

    const { error: updateError } = await supabase
      .from('emails')
      .upsert(updates);

    if (updateError) throw updateError;

    processed += emails.length;
    console.log(`Processed ${processed} emails`);
  }
}

migratePreviews().catch(console.error);
