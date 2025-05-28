// lib/types.ts

import { DayPickerProps } from "react-day-picker";

/**
 * CalendarEvent - Interface for calendar events fetched from Supabase
 */
export interface CalendarEvent {
  id: number;
  title: string;
  description?: string | null;
  date: string; // ISO string (e.g., "2025-04-05T09:00:00Z")
  endTime: string; // ISO string
  client?: string | null;
  type: string;
  location?: string | null;
  source?: string | null;
  color: string;
  layout?: {
    top?: string;
    height?: string;
    left?: string;
    width?: string;
    column?: number;
    totalColumns?: number;
  };
}

/**
 * Task - Interface for tasks fetched from Supabase
 */
export interface Task {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "High" | "Medium" | "Low";
  status: "Not Started" | "In Progress" | "Pending" | "Completed";
  client: string | null;
  client_id: number | null;
  assigned_to_name: string;
  assigned_to_avatar: string;
  assigned_to_initials: string;
  progress: number;
  tags: string[];
  source: string;
}

/**
 * Extended event interface for rendering tasks in calendar view
 */
export interface CalendarEventWithTask extends CalendarEvent {
  source: "Tasks"; // override source to ensure task-specific origin
}

export type CalendarView = "week" | "month" | "day";
