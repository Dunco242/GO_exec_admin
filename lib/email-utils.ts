// lib/email-utils.ts (or .js)
export const extractPreview = (emailText: string, length = 160): string => {
  if (!emailText) return '';

  // Remove quoted text (lines starting with >)
  const withoutQuotes = emailText.split('\n')
    .filter(line => !line.startsWith('>'))
    .join('\n');

  // Remove multiple spaces and newlines
  const cleanText = withoutQuotes.replace(/\s+/g, ' ').trim();

  // Extract first meaningful sentences
  return cleanText.length > length
    ? cleanText.substring(0, length) + '...'
    : cleanText;
};

// Optional: Add HTML stripping function if needed frequently
export const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '');
