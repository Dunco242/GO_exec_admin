import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parse, isValid, addDays, parseISO } from "date-fns";

/**
 * Merge Tailwind classes with support for conditional logic
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validate and parse a wide range of date formats into a Date object
 */
export function parseDate(dateStr: string): Date | null {
  const formats = [
    "yyyy-MM-dd",
    "MM/dd/yyyy",
    "dd/MM/yyyy",
    "MMMM d, yyyy",
    "MMMM d yyyy",
    "MMM d, yyyy",
    "MMM d yyyy",
    "d MMMM yyyy",
    "d MMM yyyy",
  ];

  for (const formatStr of formats) {
    try {
      const date = parse(dateStr, formatStr, new Date());
      if (isValid(date)) {
        return date;
      }
    } catch (e) {
      continue; // Try next format
    }
  }

  const lowerDateStr = dateStr.toLowerCase();
  const today = new Date();

  if (lowerDateStr === "today") {
    return today;
  } else if (lowerDateStr === "tomorrow") {
    return addDays(today, 1);
  } else if (lowerDateStr === "next week") {
    return addDays(today, 7);
  }

  return null;
}

/**
 * Parse time strings like "3pm", "3:30 pm", "15:00"
 */
export function parseTime(timeStr: string): string | null {
  timeStr = timeStr.toLowerCase().replace(/\s/g, "");

  const timeRegex = /^(\d{1,2})(?::(\d{2}))?(?:(am|pm))?$/;
  const match = timeStr.match(timeRegex);

  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3];

  if (ampm === "pm" && hours < 12) {
    hours += 12;
  } else if (ampm === "am" && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Extract client name from text using regex patterns
 */
export function extractClientName(text: string): string | null {
  const clientPatterns = [
    /(?:client|with|for)\s+([A-Z][A-Za-z\s]+(?:Inc|LLC|Corp|Company|Co\.?)?)/i,
    /([A-Z][A-Za-z\s]+(?:Inc|LLC|Corp|Company|Co\.?))\s+(?:client|account)/i,
  ];

  for (const pattern of clientPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Identify action type based on keywords in text
 */
export function identifyActionType(text: string): string {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("email") ||
    lowerText.includes("send") ||
    lowerText.includes("write")
  ) {
    return "email";
  } else if (
    lowerText.includes("call") ||
    lowerText.includes("phone") ||
    lowerText.includes("ring")
  ) {
    return "call";
  } else if (
    lowerText.includes("meet") ||
    lowerText.includes("meeting") ||
    lowerText.includes("appointment")
  ) {
    return "meeting";
  } else if (
    lowerText.includes("review") ||
    lowerText.includes("check") ||
    lowerText.includes("read")
  ) {
    return "review";
  } else if (
    lowerText.includes("prepare") ||
    lowerText.includes("create") ||
    lowerText.includes("make")
  ) {
    return "prepare";
  } else {
    return "task";
  }
}

/**
 * Extract priority level from task description
 */
export function extractPriority(text: string): string {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("urgent") ||
    lowerText.includes("asap") ||
    lowerText.includes("immediately") ||
    lowerText.includes("important") ||
    lowerText.includes("priority high")
  ) {
    return "High";
  } else if (
    lowerText.includes("when you have time") ||
    lowerText.includes("low priority")
  ) {
    return "Low";
  } else {
    return "Medium";
  }
}

/**
 * Parse natural language note into structured calendar data
 */
export function parseNote(note: string): {
  title: string;
  description: string;
  dueDate: string | null;
  dueTime: string | null;
  client: string | null;
  actionType: string;
  priority: string;
} {
  let extractedDate: Date | null = null;

  const datePatterns = [
    /on\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
    /by\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
    /(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:,?\s+\d{4})?)/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(today|tomorrow|next week)/i,
  ];

  for (const pattern of datePatterns) {
    const match = note.match(pattern);
    if (match && match[1]) {
      const cleanDateStr = match[1].replace(/(\d{1,2})(?:st|nd|rd|th)/, "$1");
      extractedDate = parseDate(cleanDateStr);
      if (extractedDate) break;
    }
  }

  let extractedTime: string | null = null;
  const timePatterns = [
    /at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i,
    /(\d{1,2}:\d{2})/,
  ];

  for (const pattern of timePatterns) {
    const match = note.match(pattern);
    if (match && match[1]) {
      extractedTime = parseTime(match[1]);
      if (extractedTime) break;
    }
  }

  let formattedDate: string | null = null;
  if (extractedDate && isValid(extractedDate)) {
    formattedDate = format(extractedDate, "yyyy-MM-dd");
  }

  const client = extractClientName(note);
  const actionType = identifyActionType(note);
  const priority = extractPriority(note);

  let title = note.split(/[.!?]/)[0]?.trim() || note.substring(0, 60).trim();
  if (title.length > 60) {
    title = title.substring(0, 57) + "...";
  }

  return {
    title,
    description: note.trim(),
    dueDate: formattedDate,
    dueTime: extractedTime,
    client: client || null,
    actionType,
    priority,
  };
}

/**
 * ✅ New Utility: isValidDate
 * Safely check if a value is a valid Date object
 */
export function isValidDate(date: Date | string): boolean {
  const parsedDate = typeof date === "string" ? new Date(date) : date;
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
}
