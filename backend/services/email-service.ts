// services/email-service.ts
import { supabase } from '@/lib/supabaseClient';
import { extractPreview } from '@/lib/email-utils';

export interface Email {
  id?: string;
  user_id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  text?: string;
  html?: string;
  preview?: string;
  raw_content?: string;
  is_read?: boolean;
  labels?: string[];
}

export async function processNewEmail(rawEmail: Email): Promise<void> {
  try {
    const preview = extractPreview(rawEmail.text || rawEmail.html || '');

    const { error } = await supabase
      .from('emails')
      .insert({
        ...rawEmail,
        preview,
        raw_content: rawEmail.text || rawEmail.html || '',
        is_read: false,
        labels: rawEmail.labels || []
      });

    if (error) {
      throw new Error(`Failed to insert email: ${error.message}`);
    }
  } catch (error) {
    console.error('Error processing new email:', error);
    throw error;
  }
}

export async function getRecentEmails(userId: string, limit: number = 20): Promise<Email[]> {
  try {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching recent emails:', error);
    throw error;
  }
}

export async function markEmailAsRead(emailId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('emails')
      .update({ is_read: true })
      .eq('id', emailId);

    if (error) {
      throw new Error(`Failed to mark email as read: ${error.message}`);
    }
  } catch (error) {
    console.error('Error marking email as read:', error);
    throw error;
  }
}

export async function deleteEmail(emailId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('emails')
      .delete()
      .eq('id', emailId);

    if (error) {
      throw new Error(`Failed to delete email: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting email:', error);
    throw error;
  }
}

export async function searchEmails(userId: string, query: string, limit: number = 20): Promise<Email[]> {
  try {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .textSearch('raw_content', query)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search emails: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error searching emails:', error);
    throw error;
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
}
