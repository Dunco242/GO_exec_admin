"use client"

import { useState, ChangeEvent, useCallback, useEffect, useMemo } from "react"
import { FileText, CheckSquare, Calendar as CalendarIcon, Mail, Plus, HelpCircle } from "lucide-react" // Aliased Calendar to CalendarIcon, added HelpCircle
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card" // Ensure Card components are imported correctly
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
// import { useStore } from "@/lib/store" // Removed Zustand import as data will be fetched from Supabase
import { parse, isValid, format, addMinutes, addHours, addDays } from "date-fns" // Import date-fns for robust date parsing
import { Label } from "@/components/ui/label" // Corrected Label import
import { Input } from "@/components/ui/input" // Ensure Input is imported
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client
import { User } from '@supabase/supabase-js'; // Import User type from Supabase client

// Define interfaces to match your Supabase table schemas for tasks and calendar_events
// These interfaces are for the data shape when inserting into Supabase
interface TaskInsert {
  user_id: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  status: "Not Started" | "In Progress" | "Pending" | "Completed";
  description?: string | null;
  due_date?: string | null; // ISO string (TIMESTAMPTZ)
  client_name?: string | null;
  client_id?: number | null;
  assigned_to_name?: string | null;
  assigned_to_avatar?: string | null;
  assigned_to_initials?: string | null;
  progress?: number;
  tags?: string[] | null;
  source?: string;
}

interface CalendarEventInsert {
  // user_id: string; // Removed as per schema, assuming RLS handles user context for calendar_events
  title: string;
  date: string; // ISO string (TIMESTAMPTZ)
  color: string;
  type: string;
  end_time: string; // ISO string (TIMESTAMPTZ)
  description?: string | null;
  client_name?: string | null;
  location?: string | null;
  source?: string;
}

// Interface for the data that will be stored in imported_notes table in Supabase
interface ImportedNote {
  id: number;
  user_id: string;
  content: string;
  import_date: string; // ISO string for TIMESTAMPTZ
  processed: boolean;
  extracted_items: { // JSONB column
    tasks: number[]; // Array of task IDs
    events: number[]; // Array of event IDs
    emails: number[]; // Array of email IDs
  };
  created_at: string;
  updated_at: string;
}

// This component handles the file input and processing logic
export function ImportNotes() {
  const [inputText, setInputText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<User | null>(null); // State to hold the user object
  const [userLoading, setUserLoading] = useState(true); // State to track user loading
  const { toast } = useToast();
  const [importedNotesHistory, setImportedNotesHistory] = useState<ImportedNote[]>([]); // State for imported notes history

  // Effect to get the current user's ID
  useEffect(() => {
    const getSupabaseUser = async () => {
      try {
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Error getting Supabase user:", error);
          setUser(null);
        } else {
          setUser(supabaseUser);
        }
      } catch (e) {
        console.error("Unexpected error getting Supabase user:", e);
        setUser(null);
      } finally {
        setUserLoading(false);
      }
    };
    getSupabaseUser();
  }, []); // Run once on component mount

  // Fetch imported notes history from Supabase
  const fetchImportedNotesHistory = useCallback(async () => {
    if (!user?.id) {
      setImportedNotesHistory([]); // Clear history if no user
      return;
    }
    try {
      const { data, error } = await supabase
        .from('imported_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('import_date', { ascending: false });

      if (error) {
        console.error("Error fetching imported notes history:", error);
        toast({ title: 'Error', description: `Failed to load import history: ${error.message}`, variant: 'destructive' });
      } else if (data) {
        setImportedNotesHistory(data as ImportedNote[]);
      }
    } catch (error) {
      console.error("An unexpected error occurred while fetching import history:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred while loading import history.', variant: 'destructive' });
    }
  }, [user?.id, toast]);

  // Fetch history when user becomes available
  useEffect(() => {
    if (user?.id) {
      fetchImportedNotesHistory();
    }
  }, [user?.id, fetchImportedNotesHistory]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          setInputText(text);
        }
      };
      reader.readAsText(file);
    } else {
      setFileName(null);
      setInputText("");
    }
  };

  const processImport = useCallback(async () => {
    if (!inputText.trim()) {
      toast({
        title: "Error",
        description: "Please enter or upload some notes to import.",
        variant: "destructive",
      });
      return;
    }
    if (userLoading) {
      toast({
        title: "Please Wait",
        description: "Authenticating user. Please try again in a moment.",
        variant: "default",
      });
      return;
    }
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to import notes.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    const lines = inputText.split("\n").filter((line) => line.trim() !== "");
    const extractedTaskIds: number[] = [];
    const extractedEventIds: number[] = [];
    const extractedEmailIds: number[] = []; // Placeholder for future email extraction

    let eventsCreatedCount = 0;
    let tasksCreatedCount = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const bulletRemoved = trimmedLine.startsWith("- ") ? trimmedLine.substring(2) : trimmedLine;

      let parsedDate: Date | null = null;
      let potentialEndTime: Date | null = null;
      let extractedTitle = bulletRemoved;

      // Regex to capture common date formats at the start of the string, optionally followed by a time
      // Group 1: Full date part (e.g.,YYYY-MM-DD, MM/DD/YYYY, Mon, May 28, 2025)
      // Group 6: Optional time part (e.g., 10:30, 10:30 AM, 10:30:00)
      // Group 10: The rest of the string after date/time
      const fullDateTimeRegex = /^((\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})|(\d{1,2}-\d{1,2}-\d{4})|(\w{3}, \w{3} \d{1,2}, \d{4}))(\s+(\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?))?\s*(.*)$/i;

      const match = bulletRemoved.match(fullDateTimeRegex);

      if (match) {
          const datePart = match[1];
          const timePart = match[7];
          const ampmPart = match[9];
          extractedTitle = match[10] || ''; // Update extractedTitle here

          const dateFormatsForParsing = [
              "yyyy-MM-dd", "MM/dd/yyyy", "dd-MM-yyyy", "EEE, MMM dd,yyyy"
          ];
          const timeFormatsForParsing = [
              "HH:mm", "h:mm a", "H:mm", "HH:mm:ss", "h:mm:ss a"
          ];

          let tempDate: Date | null = null;
          for (const df of dateFormatsForParsing) {
              const candidateDate = parse(datePart, df, new Date());
              if (isValid(candidateDate)) {
                  tempDate = candidateDate;
                  break; // Found a valid date, stop trying other formats
              }
          }
          parsedDate = tempDate; // parsedDate is now either a valid Date or null

          if (parsedDate && isValid(parsedDate) && timePart) {
              let tempTime: Date | null = null;
              const fullTimeStr = timePart + (ampmPart ? ` ${ampmPart}` : '');

              for (const tf of timeFormatsForParsing) {
                  const candidateTime = parse(fullTimeStr.trim(), tf, parsedDate); // Use parsedDate as base
                  if (isValid(candidateTime)) {
                      tempTime = candidateTime;
                      break;
                  }
              }

              if (tempTime && isValid(tempTime)) {
                  parsedDate.setHours(tempTime.getHours(), tempTime.getMinutes(), tempTime.getSeconds());
                  potentialEndTime = addMinutes(parsedDate, 1);
              } else if (parsedDate && isValid(parsedDate)) { // If time parsing failed but date is valid
                  potentialEndTime = addHours(parsedDate, 1);
                  console.warn(`Time parsing failed for "${fullTimeStr}". Defaulting event end time to 1 hour after start date.`);
              } else {
                  potentialEndTime = null; // If parsedDate itself is invalid, potentialEndTime should also be null
              }
          } else if (parsedDate && isValid(parsedDate)) {
              // If only date is present, default to 1 hour duration
              potentialEndTime = addHours(parsedDate, 1);
          } else {
              // If date itself could not be parsed from regex match, ensure parsedDate is null
              parsedDate = null;
          }
      }

      // Logic to differentiate between Calendar Event and Task
      if (parsedDate && isValid(parsedDate)) {
        // It's an event with a specific date/time extracted
        let finalEndTimeDate: Date; // Declare as Date object
        if (potentialEndTime && isValid(potentialEndTime)) {
            finalEndTimeDate = potentialEndTime;
        } else {
            // Fallback if potentialEndTime is invalid or not set, but parsedDate is valid
            finalEndTimeDate = addMinutes(parsedDate, 60); // Default to 1 hour later
            console.warn(`Final end time for event "${extractedTitle}" was invalid or not set. Defaulting to 1 hour after start.`);
        }

        // --- CRITICAL VALIDATION BEFORE INSERTION ---
        if (!isValid(parsedDate) || !isValid(finalEndTimeDate)) {
            console.error("CRITICAL ERROR: Invalid Date object detected for Calendar Event before database insertion. Skipping event.", { parsedDate, finalEndTimeDate, originalLine: bulletRemoved });
            toast({ title: 'Error', description: `Skipped event: Invalid date detected for "${extractedTitle}". Please check input format.`, variant: 'destructive' });
            continue; // Skip this line if dates are invalid
        }
        // --- END CRITICAL VALIDATION ---

        const dateISO = parsedDate.toISOString();
        const endTimeISO = finalEndTimeDate.toISOString();

        // --- NEW: Additional validation for ISO strings before insertion ---
        if (dateISO === "Invalid Date" || endTimeISO === "Invalid Date") {
            console.error("CRITICAL ERROR: toISOString resulted in 'Invalid Date' string for Calendar Event. Skipping event insertion.", { dateISO, endTimeISO, originalLine: bulletRemoved });
            toast({ title: 'Error', description: `Skipped event: Generated invalid date string for "${extractedTitle}".`, variant: 'destructive' });
            continue; // Skip this line if the ISO string is invalid
        }
        // --- END NEW VALIDATION ---

        const eventToInsert: CalendarEventInsert = {
          title: extractedTitle.trim() || "Imported Event",
          date: dateISO,
          end_time: endTimeISO,
          color: "#2660ff",
          type: "Imported",
          description: `Imported from notes: "${bulletRemoved}"`,
          source: "Imported Note",
        };

        const { data: newEvent, error: eventError } = await supabase
          .from('calendar_events')
          .insert([eventToInsert])
          .select('id')
          .single();

        if (eventError) {
          console.error("Error inserting calendar event:", eventError);
          toast({ title: 'Error', description: `Failed to create calendar event: ${eventError.message || 'Unknown error'}`, variant: 'destructive' });
        } else if (newEvent?.id) {
          extractedEventIds.push(newEvent.id);
          eventsCreatedCount++;
        }
      } else {
        // If parsedDate is null or invalid, treat as a Task
        console.warn(`Could not parse date for line: "${bulletRemoved}". Treating as a task.`);
        const today = new Date();
        // Default due date for tasks: end of today
        const taskDueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        // --- CRITICAL VALIDATION BEFORE INSERTION (for tasks) ---
        if (!isValid(taskDueDate)) {
            console.error("CRITICAL ERROR: Invalid Date object generated for Task due date before database insertion. Skipping task.", { taskDueDate, originalLine: bulletRemoved });
            toast({ title: 'Error', description: `Skipped task: Invalid due date generated for "${extractedTitle}". Please check input format.`, variant: 'destructive' });
            continue; // Skip this line if the due date is invalid
        }
        // --- END CRITICAL VALIDATION ---

        const taskToInsert: TaskInsert = {
            user_id: user.id,
            title: extractedTitle.trim() || "Imported Task",
            description: `Imported from notes: "${bulletRemoved}"`, // Use the full line as description
            due_date: taskDueDate.toISOString(),
            priority: "Medium", // Default priority
            status: "Not Started", // Default status
            client_name: null, // No client extracted from simple notes
            client_id: null,
            assigned_to_name: user.user_metadata?.full_name || user.email || "User", // Assign to current user
            assigned_to_avatar: user.user_metadata?.avatar_url || "/placeholder.svg?height=40&width=40",
            assigned_to_initials: user.user_metadata?.full_name ? user.user_metadata.full_name.substring(0, 2).toUpperCase() : user.email ? user.email.substring(0, 2).toUpperCase() : '?',
            progress: 0,
            tags: ["imported"], // Default tag
            source: "Imported Note",
        };

        const { data: newTask, error: taskError } = await supabase
            .from('tasks')
            .insert([taskToInsert])
            .select('id')
            .single();

        if (taskError) {
            console.error("Error inserting task:", taskError);
            toast({ title: 'Error', description: `Failed to create task: ${taskError.message || 'Unknown error'}`, variant: 'destructive' });
        } else if (newTask?.id) {
            extractedTaskIds.push(newTask.id);
            tasksCreatedCount++;
        }
      }
    }

    // Record the overall import in Supabase
    const newImportedNoteData = {
      user_id: user.id,
      content: inputText,
      import_date: new Date().toISOString(),
      processed: true,
      extracted_items: {
        tasks: extractedTaskIds,
        events: extractedEventIds,
        emails: extractedEmailIds,
      },
    };

    const { error: importError } = await supabase
      .from('imported_notes')
      .insert([newImportedNoteData]);

    if (importError) {
      console.error("Error saving imported note history:", importError);
      toast({ title: 'Error', description: `Failed to save import history: ${importError.message}`, variant: 'destructive' });
    } else {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${eventsCreatedCount} events and ${tasksCreatedCount} tasks.`,
        variant: "default",
      });
      fetchImportedNotesHistory(); // Re-fetch history to update the display
    }

    // Clear the input after successful import
    setInputText("");
    setFileName(null);
    setIsProcessing(false);
  }, [inputText, toast, user, userLoading, fetchImportedNotesHistory]);

  // Calculate statistics from fetched imported notes history
  const totalImported = importedNotesHistory.length;
  const totalTasks = importedNotesHistory.reduce((acc, note) => acc + (note.extracted_items?.tasks?.length || 0), 0);
  const totalEvents = importedNotesHistory.reduce((acc, note) => acc + (note.extracted_items?.events?.length || 0), 0);
  const totalEmails = importedNotesHistory.reduce((acc, note) => acc + (note.extracted_items?.emails?.length || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Plus className="mr-2 h-4 w-4" /> Import Notes
        </CardTitle>
        <CardDescription>Upload a .txt file or paste notes to automatically extract tasks and events.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Upload .txt File
          </Label>
          <Input id="file-upload" type="file" accept=".txt" onChange={handleFileChange} />
          {fileName && <p className="text-sm text-muted-foreground mt-1">Selected file: {fileName}</p>}
        </div>
        <div className="relative">
          <Textarea
            placeholder="Enter your notes here. Each line will be processed.
For Calendar Events: Start a line with a date (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, or EEE, MMM DD,YYYY) and optionally a time (HH:MM or HH:MM AM/PM).
Example: 2025-05-28 10:30 Client Call
Example: Jun 15, 2025 Project Deadline Review
For Tasks: Lines without a date will be treated as tasks due at the end of the current day.
Example: Follow up with marketing team"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={8}
            className="w-full"
          />
          <div className="absolute top-2 right-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => {
              toast({
                title: "Formatting Help",
                description: `Enter each note on a new line.
For Calendar Events: Start a line with a date (e.g.,YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, or EEE, MMM DD,YYYY). You can optionally add a time (e.g., HH:MM, HH:MM AM/PM). If a time is provided, the event will default to ending one minute later. If only a date is given, the event will be set for a 1-hour duration.
For Tasks: Any line not starting with a clear date will be treated as a task due at the end of the current day.`,
                duration: 15000, // Show for 15 seconds
              });
            }} />
          </div>
        </div>
        <Button onClick={processImport} disabled={isProcessing || !inputText.trim() || userLoading || !user?.id} className="bg-[#2660ff] hover:bg-[#1a4cd1]">
          {isProcessing ? "Processing..." : "Import Notes"}
        </Button>
      </CardContent>
    </Card>
  );
}

// This is your main ImportPage component
export default function ImportPage() {
  // The ImportedNotes component now manages its own state for importedNotesHistory
  // and calculates statistics internally.
  // We will pass down a prop or use context if these stats need to be displayed outside ImportNotes component.
  // For now, the stats will be calculated and displayed within the ImportNotes component itself.

  // To display the statistics here, we need to lift the state up or use a global store for these stats.
  // Given the previous context, the user wants the stats to reflect what's in Supabase.
  // So, we'll fetch them here in the parent component as well, or pass them from the child.
  // For simplicity and direct addressing of the user's issue, I'll assume the stats are needed here.

  const [importedNotesStats, setImportedNotesStats] = useState({
    totalImported: 0,
    totalTasks: 0,
    totalEvents: 0,
    totalEmails: 0,
    history: [] as ImportedNote[]
  });
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const getSupabaseUser = async () => {
      try {
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Error getting Supabase user:", error);
          setUser(null);
        } else {
          setUser(supabaseUser);
        }
      } catch (e) {
        console.error("Unexpected error getting Supabase user:", e);
        setUser(null);
      } finally {
        setUserLoading(false);
      }
    };
    getSupabaseUser();
  }, []);

  const fetchAndCalculateStats = useCallback(async () => {
    if (!user?.id) {
      setImportedNotesStats({
        totalImported: 0,
        totalTasks: 0,
        totalEvents: 0,
        totalEmails: 0,
        history: []
      });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('imported_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('import_date', { ascending: false });

      if (error) {
        console.error("Error fetching imported notes for stats:", error);
        toast({ title: 'Error', description: `Failed to load import stats: ${error.message}`, variant: 'destructive' });
      } else if (data) {
        const totalImported = data.length;
        const totalTasks = data.reduce((acc, note) => acc + (note.extracted_items?.tasks?.length || 0), 0);
        const totalEvents = data.reduce((acc, note) => acc + (note.extracted_items?.events?.length || 0), 0);
        const totalEmails = data.reduce((acc, note) => acc + (note.extracted_items?.emails?.length || 0), 0);
        setImportedNotesStats({
          totalImported,
          totalTasks,
          totalEvents,
          totalEmails,
          history: data as ImportedNote[]
        });
      }
    } catch (error) {
      console.error("An unexpected error occurred while fetching import stats:", error);
      toast({ title: 'Error', description: 'An unexpected error occurred while loading import stats.', variant: 'destructive' });
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (user?.id) {
      fetchAndCalculateStats();
    }
  }, [user?.id, fetchAndCalculateStats]);


  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="md:hidden">
          <MobileNav />
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Import Notes</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Imports</CardTitle>
              <FileText className="h-4 w-4 text-[#2660ff]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{importedNotesStats.totalImported}</div>
              <p className="text-xs text-muted-foreground">Text notes imported and processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks Created</CardTitle>
              <CheckSquare className="h-4 w-4 text-[#2660ff]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{importedNotesStats.totalTasks}</div>
              <p className="text-xs text-muted-foreground">Tasks extracted from notes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Events Scheduled</CardTitle>
              <CalendarIcon className="h-4 w-4 text-[#2660ff]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{importedNotesStats.totalEvents}</div>
              <p className="text-xs text-muted-foreground">Calendar events created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Drafted</CardTitle>
              <Mail className="h-4 w-4 text-[#2660ff]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{importedNotesStats.totalEmails}</div>
              <p className="text-xs text-muted-foreground">Email drafts prepared</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {/* Pass the user and fetchAndCalculateStats function to ImportNotes */}
          <ImportNotes />
        </div>

        {importedNotesStats.history.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Import History</h3>
            <div className="space-y-4">
              {importedNotesStats.history
                .map((note) => (
                  <Card key={note.id}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Import #{note.id}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                          {new Date(note.import_date).toLocaleString()}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <CheckSquare className="h-4 w-4 mr-2 text-[#2660ff]" />
                          <span>{note.extracted_items?.tasks?.length || 0} tasks</span>
                        </div>
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-2 text-[#2660ff]" />
                          <span>{note.extracted_items?.events?.length || 0} events</span>
                        </div>
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-[#2660ff]" />
                          <span>{note.extracted_items?.emails?.length || 0} emails</span>
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-muted-foreground line-clamp-3">{note.content}</div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
