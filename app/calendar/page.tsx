"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, setHours, setMinutes, parseISO, addHours, isValid, Locale } from "date-fns";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea"; // Fixed: Added missing import
import { Save, ChevronLeft, ChevronRight, Plus, Edit, Trash2, MoreHorizontal } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "app/components/calendar.css";

// Define types
interface CalendarEvent {
  id: number;
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: string;
  color: string;
  user_id?: string;
}

interface Task {
  id: number;
  title: string;
  due_date: string; // YYYY-MM-DD
  project_id: number | null;
}

interface BigCalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource: CalendarEvent | Task;
  color?: string;
}

// Dynamic imports to avoid SSR issues
const BigCalendar = dynamic(() => import("react-big-calendar").then((mod) => mod.Calendar), {
  ssr: false,
  loading: () => <p>Loading calendar...</p>,
});

const DragAndDropCalendar = dynamic(
  () =>
    import("react-big-calendar/lib/addons/dragAndDrop").then((mod) => {
      const withDnD = mod.default;
      return withDnD(BigCalendar);
    }),
  {
    ssr: false,
    loading: () => <p>Loading drag-and-drop...</p>,
  }
);

// Localizer setup
import { dateFnsLocalizer, DateLocalizer, stringOrDate } from "react-big-calendar";
import { enUS } from "date-fns/locale/en-US"; // ✅ Fixed: Import destructured
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

const localizer = dateFnsLocalizer({
  format,
  parse: (str: string, formatStr: string, referenceDate: Date) => parseISO(str), // ✅ Added proper types
  startOfWeek: (locale: Locale) => startOfWeek(new Date(), { locale }), // ✅ Added Locale type
  getDay: (date: Date) => date.getDay(), // ✅ Added Date type
  locales: {
    "en-US": enUS,
  },
});

export default function CalendarApp() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");
  const [events, setEvents] = useState<BigCalendarEvent[]>([]);
  const [todayEvents, setTodayEvents] = useState<BigCalendarEvent[]>([]);
  const [openAddEventModal, setOpenAddEventModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<BigCalendarEvent | null>(null);
  const [canEdit, setCanEdit] = useState<boolean>(false);

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: format(currentDate, "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    description: "",
    type: "meeting",
    location: "",
    color: "#2660ff",
    client_name: "",
  });

  // Fetch user ID
  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw error || new Error("User not authenticated");

        setUserId(user.id);
      } catch (error: any) {
        toast({
          title: "Authentication Error",
          description: error.message || "Failed to get user information",
          variant: "destructive"
        });
      }
    };

    getUserId();
  }, []);

  // Fetch calendar events and tasks
  const fetchEventsAndTasks = useCallback(async () => {
    if (!userId) return;

    try {
      const [{ data: eventData, error: eventError }, { data: taskData, error: taskError }] = await Promise.all([
        supabase.from("calendar_events").select("*").eq("user_id", userId),
        supabase.from("tasks").select("*").eq("user_id", userId),
      ]);

      if (eventError || taskError) {
        throw new Error("Failed to load events or tasks");
      }

      const mappedEvents = eventData.map(mapSupabaseEventToBigCalendarEvent);
      const mappedTasks = taskData.map(mapSupabaseTaskToBigCalendarEvent);

      setEvents([...mappedEvents, ...mappedTasks]);

      const today = new Date();
      const todayString = format(today, "yyyy-MM-dd");
      const todayEvents = [...mappedEvents, ...mappedTasks].filter(event =>
        format(event.start, "yyyy-MM-dd") === todayString
      );

      setTodayEvents(todayEvents);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [userId]);

  useEffect(() => {
    fetchEventsAndTasks();
  }, [fetchEventsAndTasks]);

  // Map Supabase Event to BigCalendar Event
  const mapSupabaseEventToBigCalendarEvent = (event: CalendarEvent): BigCalendarEvent => {
    const startDate = parseISO(event.date);
    const [startHours, startMinutes] = event.startTime.split(":").map(Number);
    let start = setMinutes(setHours(startDate, startHours), startMinutes);

    const endDate = parseISO(event.date);
    const [endHours, endMinutes] = event.endTime.split(":").map(Number);
    let end = setMinutes(setHours(endDate, endHours), endMinutes);

    if (end < start) {
      end = addHours(end, 24); // Span across midnight
    }

    return {
      id: event.id,
      title: event.title,
      start,
      end,
      resource: event,
      color: event.color,
    };
  };

  // Map Supabase Task to BigCalendar Event
  const mapSupabaseTaskToBigCalendarEvent = (task: Task): BigCalendarEvent => {
    const date = parseISO(task.due_date);
    const start = setHours(setMinutes(date, 0), 0);
    const end = setHours(setMinutes(date, 59), 23);

    return {
      id: -task.id, // Use negative ID to differentiate from events
      title: `Task: ${task.title}`,
      start,
      end,
      allDay: true,
      resource: { ...task, type: "task", color: "#800080" },
      color: "#800080",
    };
  };

  // Handle event drop
  const onEventDrop = useCallback(
    async ({ event, start, end }: any) => {
      if (!userId) return;

      const isTask = (event.resource as { type?: string }).type === "task";
      const tableName = isTask ? "tasks" : "calendar_events";
      const recordId = isTask ? Math.abs(event.id) : event.id;

      const updatedEvents = events.map((e) =>
        e.id === event.id ? { ...e, start, end } : e
      );
      setEvents(updatedEvents);

      try {
        const updateData = isTask
            ? { due_date: format(start, "yyyy-MM-dd") }
            : {
                date: format(start, "yyyy-MM-dd"),
                startTime: format(start, "HH:mm"),
                endTime: format(end, "HH:mm"),
              };

        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq("id", recordId)
          .eq("user_id", userId);

        if (error) throw error;

        toast({ title: "Event Moved", description: `"${event.title}" has been moved.` });
      } catch (error: any) {
        toast({
          title: "Move Failed",
          description: error.message,
          variant: "destructive"
        });
        setEvents(events); // Revert optimistic update
      }
    },
    [userId, events]
  );

  // Handle event resize
  const onEventResize = useCallback(
    async ({ event, start, end }: { event: any; start: stringOrDate; end: stringOrDate }) => {
      if (!userId || (event.resource as { type?: string }).type === "task") return;

      const startDate = start instanceof Date ? start : new Date(start);
      const endDate = end instanceof Date ? end : new Date(end);

      try {
        const { error } = await supabase
          .from("calendar_events")
          .update({
            date: format(start, "yyyy-MM-dd"),
            startTime: format(start, "HH:mm"),
            endTime: format(end, "HH:mm"),
          })
          .eq("id", event.id)
          .eq("user_id", userId);

        if (error) throw error;

        toast({ title: "Event Resized", description: `"${event.title}" has been resized.` });
        fetchEventsAndTasks(); // Refresh
      } catch (error: any) {
        toast({
          title: "Resize Failed",
          description: error.message,
          variant: "destructive"
        });
      }
    },
    [userId]
  );

  // Event prop getter for styling
  const eventPropGetter = useCallback((event: any) => ({
    style: {
      backgroundColor: event.color || "#2660ff",
      borderRadius: "5px",
      opacity: 0.9,
      color: "white",
      border: "1px solid #2660ff",
    },
  }), []);

  // Navigate calendar view
  const navigate = (action: "PREV" | "NEXT" | "TODAY") => {
    let newDate = new Date(currentDate);

    switch (action) {
      case "PREV":
        calendarView === "month"
          ? newDate.setMonth(newDate.getMonth() - 1)
          : calendarView === "week"
          ? newDate.setDate(newDate.getDate() - 7)
          : newDate.setDate(newDate.getDate() - 1);
        break;
      case "NEXT":
        calendarView === "month"
          ? newDate.setMonth(newDate.getMonth() + 1)
          : calendarView === "week"
          ? newDate.setDate(newDate.getDate() + 7)
          : newDate.setDate(newDate.getDate() + 1);
        break;
      case "TODAY":
        newDate = new Date();
        break;
    }

    setCurrentDate(newDate);
  };

  // Get current calendar title
  const getCalendarTitle = () => {
    switch (calendarView) {
      case "month":
        return format(currentDate, "MMMM yyyy");
      case "week": {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = startOfWeek(currentDate, { weekStartsOn: 0 });
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      }
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      default:
        return "";
    }
  };

  // Handle event selection
  const handleSelectEvent = (event: object, e: React.SyntheticEvent<HTMLElement>) => {
    const calEvent = event as BigCalendarEvent;
    setSelectedEvent(calEvent);
    setCanEdit(true); // Replace with real permission logic
    router.push(`/calendar/${calEvent.id}`);
  };

  // Reset form fields
  const resetNewEvent = () => {
    setNewEvent({
      title: "",
      date: format(currentDate, "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:00",
      description: "",
      type: "meeting",
      location: "",
      color: "#2660ff",
      client_name: "",
    });
  };

  // Handle input changes in modal
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setNewEvent(prev => ({ ...prev, [id]: value }));
  };

  // Create new event
  const handleCreateNewEvent = async () => {
    if (!userId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    if (!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime) {
      toast({ title: "Missing Information", description: "Please fill out all required fields", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({
          title: newEvent.title,
          date: newEvent.date,
          startTime: newEvent.startTime,
          endTime: newEvent.endTime,
          description: newEvent.description,
          type: newEvent.type,
          location: newEvent.location,
          color: newEvent.color,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Event Created", description: "Your event has been successfully created." });
      setOpenAddEventModal(false);
      resetNewEvent();
      fetchEventsAndTasks();
    } catch (error: any) {
      console.error("Error creating event:", error.message);
      toast({ title: "Error creating event", description: error.message, variant: "destructive" });
    }
  };

  // Update existing event
  const handleUpdateEvent = async () => {
    if (!userId || !selectedEvent?.resource.id) {
      toast({ title: "Error", description: "No event selected or user not authenticated", variant: "destructive" });
      return;
    }

    const isTask = (selectedEvent.resource as { type?: string }).type === "task";
    const tableName = isTask ? "tasks" : "calendar_events";
    const recordId = isTask ? Math.abs(selectedEvent.id) : selectedEvent.id;

    const updateData = isTask
      ? { title: newEvent.title, due_date: newEvent.date }
      : {
          title: newEvent.title,
          date: newEvent.date,
          startTime: newEvent.startTime,
          endTime: newEvent.endTime,
          description: newEvent.description,
          type: newEvent.type,
          location: newEvent.location,
          color: newEvent.color,
        };

    try {
      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", recordId)
        .eq("user_id", userId);

      if (error) throw error;

      toast({ title: "Event Updated", description: "Your event has been successfully updated." });
      setOpenAddEventModal(false);
      setSelectedEvent(null);
      resetNewEvent();
      fetchEventsAndTasks();
    } catch (error: any) {
      console.error("Error updating event:", error.message);
      toast({ title: "Error updating event", description: error.message, variant: "destructive" });
    }
  };

  // Delete event
  const handleDeleteEvent = async () => {
    if (!userId || !selectedEvent?.resource.id) {
      toast({ title: "Error", description: "No event selected for deletion or user not authenticated", variant: "destructive" });
      return;
    }

    const isTask = (selectedEvent.resource as { type?: string }).type === "task";
    const tableName = isTask ? "tasks" : "calendar_events";
    const recordId = isTask ? Math.abs(selectedEvent.id) : selectedEvent.id;

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", recordId)
        .eq("user_id", userId);

      if (error) throw error;

      toast({ title: "Event Deleted", description: "The event has been successfully deleted." });
      setOpenAddEventModal(false);
      setSelectedEvent(null);
      resetNewEvent();
      fetchEventsAndTasks();
    } catch (error: any) {
      console.error("Error deleting event:", error.message);
      toast({ title: "Error deleting event", description: error.message, variant: "destructive" });
    }
  };

  // Handle view changes
  const handleViewChange = (view: string) => {
    setCalendarView(view as "month" | "week" | "day");
  };

  // Wrap BigCalendar with DragAndDrop conditionally
  const DnDCalendar = withDragAndDrop ? withDragAndDrop(BigCalendar) : BigCalendar;

  return (
    <div className="flex flex-col lg:flex-row space-y-6 lg:space-y-0 lg:space-x-6 p-6 h-full">
      {/* Calendar */}
      <div className="w-full lg:w-3/4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-2xl font-bold">{getCalendarTitle()}</CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="icon" onClick={() => navigate("PREV")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate("TODAY")}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigate("NEXT")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Tabs value={calendarView} onValueChange={(v) => handleViewChange(v as "month" | "week" | "day")}>
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            </CardHeader>
          <CardContent>
            {DnDCalendar && (
              <DnDCalendar
                localizer={localizer}
                events={events}
                startAccessor={(event: any) => new Date(event.start)}
                endAccessor={(event: any) => new Date((event as BigCalendarEvent).end)}
                views={["month", "week", "day"]}
                view={calendarView}
                date={currentDate}
                onNavigate={setCurrentDate}
                onView={handleViewChange}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={() => {}}
                eventPropGetter={eventPropGetter}
                selectable
                resizable
                onEventDrop={onEventDrop}
                onEventResize={onEventResize}
                style={{ height: "calc(100vh - 200px)" }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Events Panel */}
      <div className="w-full lg:w-1/4">
        <Card>
          <CardHeader>
            <CardTitle>Today's Events</CardTitle>
            <CardDescription>Events scheduled for today.</CardDescription>
          </CardHeader>
          <CardContent>
            {todayEvents.length > 0 ? (
              <ScrollArea className="h-[400px] pr-4">
                <ul className="space-y-4">
                  {todayEvents.map((event) => (
                    <li key={event.id} className="border-b pb-2">
                      <h3 className="font-medium">{event.title}</h3>
                      <p className="text-sm text-gray-500">
                        {isValid(event.start) && isValid(event.end) ? (
                          <>
                            {format(event.start, "hh:mm a")} – {format(event.end, "hh:mm a")}
                          </>
                        ) : (
                          "Invalid date"
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">No events or tasks for today.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Event Modal */}
      <AlertDialog open={openAddEventModal} onOpenChange={setOpenAddEventModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedEvent ? "Edit Event" : "Add New Event"}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEvent ? "Modify your event details below" : "Enter details for your new event"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title</Label>
              <Input
                id="title"
                value={newEvent.title}
                onChange={handleInputChange}
                placeholder="Event title"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">Date</Label>
              <Input
                id="date"
                type="date"
                value={newEvent.date}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startTime" className="text-right">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={newEvent.startTime}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endTime" className="text-right">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={newEvent.endTime}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">Location</Label>
              <Input
                id="location"
                value={newEvent.location}
                onChange={handleInputChange}
                placeholder="Optional"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right pt-2">Description</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={handleInputChange}
                rows={3}
                className="col-span-3"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedEvent(null);
              resetNewEvent();
            }}>
              Cancel
            </AlertDialogCancel>
            {selectedEvent && (
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteEvent}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </AlertDialogAction>
            )}
            <Button onClick={selectedEvent ? handleUpdateEvent : handleCreateNewEvent}>
              <Save className="mr-2 h-4 w-4" /> {selectedEvent ? "Update" : "Create"} Event
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
