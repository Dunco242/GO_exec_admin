"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfDay,
  endOfDay,
} from "date-fns"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabaseClient"
import { isValidDate } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface CalendarEvent {
  id: number
  title: string
  description?: string | null
  date: string
  endTime: string
  client_name?: string | null
  type: string
  location?: string | null
  source?: string
  color: string
}

type CalendarView = "week" | "month" | "day"

const timeSlots = Array.from({ length: 12 }, (_, i) => i + 8) // 8am - 7pm

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [currentDay, setCurrentDay] = useState(new Date())
  const [calendarView, setCalendarView] = useState<CalendarView>("week")
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [openAddEventModal, setOpenAddEventModal] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: format(selectedDate, "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    description: "",
    type: "meeting",
    location: "",
    color: "#2660ff",
    client_name: "",
    source: "Manual",
  })
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const { toast } = useToast()

  const [allClients, setAllClients] = useState<{ id: number; name: string }[]>([])
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)

  const weekDays = eachDayOfInterval({
    start: currentWeek,
    end: endOfWeek(currentWeek, { weekStartsOn: 1 }),
  })

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((event) => {
      try {
        const eventDate = new Date(event.date)
        return isValidDate(eventDate) && isSameDay(eventDate, day)
      } catch (err) {
        console.warn("Invalid event date:", event.date)
        return false
      }
    })
  }

  const navigatePrevious = () => {
    if (calendarView === "week") {
      const prevWeek = addDays(currentWeek, -7)
      setCurrentWeek(prevWeek)
      setSelectedDate(prevWeek)
    } else if (calendarView === "month") {
      const prevMonth = addDays(currentMonth, -30)
      setCurrentMonth(prevMonth)
      setSelectedDate(prevMonth)
    } else if (calendarView === "day") {
      const prevDay = addDays(currentDay, -1)
      setCurrentDay(prevDay)
      setSelectedDate(prevDay)
    }
  }

  const navigateNext = () => {
    if (calendarView === "week") {
      const nextWeek = addDays(currentWeek, 7)
      setCurrentWeek(nextWeek)
      setSelectedDate(nextWeek)
    } else if (calendarView === "month") {
      const nextMonth = addDays(currentMonth, 30)
      setCurrentMonth(nextMonth)
      setSelectedDate(nextMonth)
    } else if (calendarView === "day") {
      const nextDay = addDays(currentDay, 1)
      setCurrentDay(nextDay)
      setSelectedDate(nextDay)
    }
  }

  const selectDay = (day: Date) => {
    setSelectedDate(day)
    if (calendarView === "month") {
      setCalendarView("day")
      setCurrentDay(day)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target

    if (id === "client_name") {
      setNewEvent((prev) => ({ ...prev, client_name: value }))
      setClientSearchTerm(value)
    } else {
      setNewEvent((prev) => ({ ...prev, [id]: value }))
    }
  }

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .ilike("name", `%${clientSearchTerm}%`)
        .order("name")

      if (error) throw error

      setAllClients(data || [])
    } catch (err) {
      console.error("Error fetching clients:", err)
    }
  }

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase.from("calendar_events").select("*").order("date")

      if (error) {
        throw error
      }

      const formattedEvents = data
        .map((event) => {
          let parsedDate: Date
          let parsedEnd: Date

          try {
            parsedDate = new Date(event.date)
            parsedEnd = new Date(event.end_time)
          } catch (err) {
            console.warn("Invalid event date:", event.id, "- skipping.")
            return null
          }

          if (!isValidDate(parsedDate) || !isValidDate(parsedEnd)) {
            console.warn("Skipping invalid event", event.id)
            return null
          }

          return {
            id: event.id,
            title: event.title,
            description: event.description,
            date: event.date,
            endTime: event.end_time,
            client_name: event.client_name,
            type: event.type,
            location: event.location,
            source: event.source,
            color: event.color,
          }
        })
        .filter(Boolean) as CalendarEvent[]

      setEvents(formattedEvents)
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to fetch calendar events: ${err.message}`,
        variant: "destructive",
      })
    }
  }

  const fetchTasksForCalendar = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, client_name")
        .not("due_date", "is.null", "")

      if (error) {
        if (error.code === "PGRST101" || error.message.includes("does not exist")) {
          toast({
            title: "Info",
            description: "Tasks table not found. Task integration skipped.",
            variant: "default",
          })
          return
        }
        console.error("Error fetching tasks for calendar:", error.message)
        toast({
          title: "Error",
          description: `Failed to fetch tasks for calendar: ${error.message}`,
          variant: "destructive",
        })
        return
      }

      if (!data || data.length === 0) {
        console.log("No tasks found with due dates.")
        return
      }

      const formattedTasks = data
        .map((task) => {
          if (!task.due_date) return null

          let parsedDate: Date
          try {
            parsedDate = new Date(task.due_date)
          } catch (e) {
            console.warn("Invalid task due_date:", task.due_date)
            return null
          }

          if (!isValidDate(parsedDate)) {
            console.warn("Skipping task due to invalid date:", task.id, task.due_date)
            return null
          }

          return {
            id: -task.id,
            title: task.title || "Untitled Task",
            description: null,
            date: parsedDate.toISOString(),
            endTime: parsedDate.toISOString(),
            client_name: task.client_name || "",
            type: "Task",
            location: null,
            source: "Tasks",
            color: "#800080",
          }
        })
        .filter(Boolean) as CalendarEvent[]

      setEvents((prev) => [...prev, ...formattedTasks])
    } catch (err) {
      console.error("Unexpected error while fetching tasks:", err)
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching tasks for calendar.",
        variant: "destructive",
      })
    }
  }

  const handleCreateNewEvent = async () => {
    const startDate = new Date(`${newEvent.date}T${newEvent.startTime}`)
    const endDate = new Date(`${newEvent.date}T${newEvent.endTime}`)

    if (startDate >= endDate) {
      toast({
        title: "Invalid Time",
        description: "Start time must be before end time.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase.from("calendar_events").insert([
        {
          title: newEvent.title,
          description: newEvent.description,
          date: startDate.toISOString(),
          end_time: endDate.toISOString(),
          client_name: newEvent.client_name,
          type: newEvent.type,
          location: newEvent.location,
          source: newEvent.source,
          color: newEvent.color,
        },
      ])

      if (error) {
        throw error
      }

      setOpenAddEventModal(false)
      setNewEvent({
        title: "",
        date: format(selectedDate, "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        description: "",
        type: "meeting",
        location: "",
        color: "#2660ff",
        client_name: "",
        source: "Manual",
      })

      toast({
        title: "Success",
        description: `Event "${newEvent.title}" created.`,
      })

      fetchEvents()
      fetchTasksForCalendar()
    } catch (err: any) {
      console.error("Error creating event:", err)
      toast({
        title: "Error",
        description: `Failed to create event: ${err.message}`,
        variant: "destructive",
      })
    }
  }

  const handleEditEventClick = (event: CalendarEvent) => {
    const eventDate = new Date(event.date)
    const eventEndTime = event.endTime ? new Date(event.endTime) : new Date(event.date)

    setNewEvent({
      title: event.title,
      description: event.description || "",
      date: isValidDate(eventDate) ? format(eventDate, "yyyy-MM-dd") : "",
      startTime: isValidDate(eventDate) ? format(eventDate, "HH:mm:ss") : "09:00",
      endTime: isValidDate(eventEndTime) ? format(eventEndTime, "HH:mm:ss") : "10:00",
      client_name: event.client_name || "",
      type: event.type || "meeting",
      location: event.location || "",
      color: event.color || "#2660ff",
      source: event.source || "Manual",
    })

    setClientSearchTerm(event.client_name || "")
    setSelectedEvent(event)
    setOpenAddEventModal(true)
  }

  const handleUpdateEvent = async () => {
    if (!selectedEvent || !newEvent) return

    const startDate = new Date(`${newEvent.date}T${newEvent.startTime}`)
    const endDate = new Date(`${newEvent.date}T${newEvent.endTime}`)

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      toast({
        title: "Invalid Date",
        description: "Could not update event due to invalid date format.",
        variant: "destructive",
      })
      return
    }

    try {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          title: newEvent.title,
          description: newEvent.description,
          date: startDate.toISOString(),
          end_time: endDate.toISOString(),
          client_name: newEvent.client_name,
          type: newEvent.type,
          location: newEvent.location,
          source: newEvent.source,
          color: newEvent.color,
        })
        .eq("id", selectedEvent.id)

      if (error) {
        throw error
      }

      toast({
        title: "Success",
        description: `Event "${newEvent.title}" updated.`,
      })

      setOpenAddEventModal(false)
      setNewEvent({
        title: "",
        date: format(selectedDate, "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        description: "",
        type: "meeting",
        location: "",
        color: "#2660ff",
        client_name: "",
        source: "Manual",
      })
      setSelectedEvent(null)
      fetchEvents()
    } catch (err: any) {
      console.error("Error updating event:", err)
      toast({
        title: "Error",
        description: `Failed to update event: ${err.message}`,
        variant: "destructive",
      })
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return

    try {
      const { error } = await supabase.from("calendar_events").delete().eq("id", selectedEvent.id)

      if (error) {
        throw error
      }

      toast({
        title: "Success",
        description: `Event "${selectedEvent.title}" deleted.`,
      })

      setSelectedEvent(null)
      setOpenAddEventModal(false)
      fetchEvents()
    } catch (err: any) {
      console.error("Error deleting event:", err)
      toast({
        title: "Error",
        description: `Failed to delete event: ${err.message}`,
        variant: "destructive",
      })
    }
  }

  const renderWeekView = () => (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Week of {format(currentWeek, "MMMM d yyyy")}</CardTitle>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-4 border-b pb-2">
          {weekDays.map((day, i) => (
            <div key={i} className="text-xs text-muted-foreground text-center">
              <div>{format(day, "EEE")}</div>
              <div className="text-sm">{format(day, "d")}</div>
            </div>
          ))}
        </div>

        <ScrollArea className="h-[500px] mt-4">
          <div className="relative">
            {timeSlots.map((hour) => (
              <div key={hour} className="grid grid-cols-7 border-t h-16">
                <div className="text-right pr-2 text-xs text-muted-foreground flex items-center justify-end">
                  {hour % 12 === 0 ? 12 : hour % 12}
                  {hour < 12 ? "am" : "pm"}
                </div>
                {weekDays.map((day, index) => {
                  const dayEvents = getEventsForDay(day).filter((event) => new Date(event.date).getHours() === hour)

                  return (
                    <div key={index} className="h-16 border-l relative p-1">
                      {dayEvents.length > 0 && (
                        <div
                          className="absolute inset-x-1 rounded-md p-1 text-xs text-white overflow-hidden cursor-pointer"
                          style={{
                            top: "4px",
                            height: "calc(100% - 8px)",
                            backgroundColor: dayEvents[0].color,
                          }}
                          onClick={() => handleEditEventClick(dayEvents[0])}
                        >
                          <div className="font-medium">{dayEvents[0].title}</div>
                          <div>
                            {format(new Date(dayEvents[0].date), "h:mm a")} -{" "}
                            {format(new Date(dayEvents[0].endTime), "h:mm a")}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )

  const renderMonthView = () => (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
            <div key={idx} className="text-center text-xs font-medium text-muted-foreground">
              {dayName}
            </div>
          ))}

          {monthDays.map((day) => {
            const dayEvents = getEventsForDay(day)
            const hasEvents = dayEvents.length > 0

            return (
              <div
                key={day.toISOString()}
                className={`text-center p-2 font-medium cursor-pointer rounded-md ${
                  isSameDay(day, selectedDate)
                    ? "bg-[#2660ff] text-white"
                    : isSameDay(day, new Date())
                      ? "font-bold"
                      : hasEvents
                        ? "bg-gray-100 dark:bg-gray-800"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                onClick={() => selectDay(day)}
              >
                <div>{format(day, "d")}</div>
                {hasEvents && <div className="w-1 h-1 mx-auto mt-1 rounded-full bg-blue-500"></div>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )

  const renderDayView = () => {
    const dayEvents = getEventsForDay(currentDay)
    const allDayEvents = dayEvents.filter((event) => {
      const eventStart = new Date(event.date)
      const eventEnd = event.endTime ? new Date(event.endTime) : eventStart
      const start = startOfDay(currentDay)
      const end = endOfDay(currentDay)

      return eventStart >= start && eventEnd <= end
    })

    const timedEvents = dayEvents.filter((event) => !allDayEvents.includes(event))

    const getHourEventsWithLayout = (hour: number) => {
      const hourStart = new Date(currentDay)
      hourStart.setHours(hour, 0, 0, 0)
      const hourEnd = new Date(currentDay)
      hourEnd.setHours(hour + 1, 0, 0, 0)

      const eventsInHour = timedEvents.filter((event) => {
        const eventStart = new Date(event.date)
        const eventEnd = event.endTime ? new Date(event.endTime) : eventStart
        return eventStart < hourEnd && eventEnd > hourStart
      })

      if (eventsInHour.length === 0) return []

      const layouts: Record<number, { column: number; totalColumns: number }> = {}
      const columns: Date[] = []

      eventsInHour.forEach((event) => {
        let placed = false
        const eventStart = new Date(event.date)
        const eventEnd = event.endTime ? new Date(event.endTime) : eventStart

        for (let i = 0; i < columns.length; i++) {
          if (eventStart >= columns[i]) {
            layouts[event.id] = { column: i, totalColumns: columns.length }
            columns[i] = eventEnd
            placed = true
            break
          }
        }

        if (!placed) {
          layouts[event.id] = { column: columns.length, totalColumns: columns.length + 1 }
          columns.push(eventEnd)
        }
      })

      return eventsInHour.map((event) => {
        const eventStart = new Date(event.date)
        const eventEnd = event.endTime ? new Date(event.endTime) : eventStart
        const startMinutes = (eventStart.getHours() - 8) * 60 + eventStart.getMinutes()
        const durationMinutes =
          (eventEnd.getHours() - eventStart.getHours()) * 60 + (eventEnd.getMinutes() - eventStart.getMinutes())

        const topRatio = startMinutes / (11 * 60)
        const heightRatio = durationMinutes / (11 * 60)
        const layout = layouts[event.id]
        const totalColumns = layout?.totalColumns || 1
        const column = layout?.column || 0
        const eventWidthPercentage = 100 / totalColumns
        const horizontalOffsetPercentage = column * eventWidthPercentage

        return {
          ...event,
          layout: {
            top: `${topRatio * 100}%`,
            height: `calc(${heightRatio * 100}% - 2px)`,
            left: `${horizontalOffsetPercentage}%`,
            width: `calc(${eventWidthPercentage}% - 2px)`,
          },
        }
      })
    }

    return (
      <Card className="col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{format(currentDay, "EEEE, MMMM d, yyyy")}</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allDayEvents.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">All Day Events</h3>
              <div className="space-y-1">
                {allDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-2 rounded-md text-white text-sm cursor-pointer"
                    style={{ backgroundColor: event.color }}
                    onClick={() => handleEditEventClick(event)}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          <ScrollArea className="h-[500px]">
            <div className="relative">
              {timeSlots.map((hour) => {
                const hourEventsWithLayout = getHourEventsWithLayout(hour)

                return (
                  <div key={hour} className="relative h-16 border-t">
                    <div className="absolute left-0 top-0 text-right pr-2 text-xs text-muted-foreground w-16 flex items-center justify-end h-full">
                      {hour % 12 === 0 ? 12 : hour % 12}
                      {hour < 12 ? "am" : "pm"}
                    </div>
                    <div className="ml-16 relative h-full border-l">
                      {hourEventsWithLayout.map((event) => (
                        <div
                          key={event.id}
                          className="absolute rounded-md p-1 text-xs text-white overflow-hidden cursor-pointer"
                          style={{
                            top: event.layout.top,
                            height: event.layout.height,
                            left: event.layout.left,
                            width: event.layout.width,
                            backgroundColor: event.color,
                          }}
                          onClick={() => handleEditEventClick(event)}
                        >
                          <div className="font-medium">{event.title}</div>
                          <div>
                            {format(new Date(event.date), "h:mm a")} - {format(new Date(event.endTime), "h:mm a")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    )
  }

  const renderCalendarView = () => {
    if (calendarView === "week") return renderWeekView()
    if (calendarView === "month") return renderMonthView()
    if (calendarView === "day") return renderDayView()
    return renderWeekView()
  }

  useEffect(() => {
    fetchEvents()
    fetchTasksForCalendar()
    fetchClients()
  }, [])

  useEffect(() => {
    if (clientSearchTerm) {
      fetchClients()
    }
  }, [clientSearchTerm])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setOpenAddEventModal(true)}>Add Event</Button>
          <Button variant="outline" size="icon" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Tabs value={calendarView} onValueChange={(value) => setCalendarView(value as CalendarView)}>
          <TabsList className="justify-start ml-1">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="day">Day</TabsTrigger>
          </TabsList>
          <TabsContent value="week" className="m-0 p-0">
            {renderWeekView()}
          </TabsContent>
          <TabsContent value="month" className="m-0 p-0">
            {renderMonthView()}
          </TabsContent>
          <TabsContent value="day" className="m-0 p-0">
            {renderDayView()}
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Today's Events</h2>
          <ScrollArea className="max-h-[400px]">
            <div className="grid gap-2">
              {getEventsForDay(currentDay).length > 0 ? (
                getEventsForDay(currentDay).map((event) => (
                  <Card
                    key={event.id}
                    className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleEditEventClick(event)}
                  >
                    <CardTitle className="text-sm font-medium">{event.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {format(new Date(event.date), "h:mm a")} -{" "}
                      {event.endTime ? format(new Date(event.endTime), "h:mm a") : ""}
                    </CardDescription>
                  </Card>
                ))
              ) : (
                <p>No events scheduled for today.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      <Dialog open={openAddEventModal} onOpenChange={setOpenAddEventModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent ? "Edit Event" : "Add New Event"}</DialogTitle>
            <DialogDescription>Create or edit an event for your calendar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input id="title" value={newEvent.title} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date
              </Label>
              <Input id="date" type="date" value={newEvent.date} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startTime" className="text-right">
                Start Time
              </Label>
              <Input
                id="startTime"
                type="time"
                value={newEvent.startTime}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endTime" className="text-right">
                End Time
              </Label>
              <Input
                id="endTime"
                type="time"
                value={newEvent.endTime}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="client_name" className="text-right">
                Client
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="client_name"
                  value={newEvent.client_name}
                  onChange={handleInputChange}
                  onFocus={() => setShowClientSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                  placeholder="Search or enter client name"
                  className="col-span-3"
                />
                {showClientSuggestions && allClients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border shadow-md max-h-40 overflow-y-auto">
                    {allClients
                      .filter((client) => client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()))
                      .map((client) => (
                        <div
                          key={client.id}
                          className="p-2 hover:bg-accent cursor-pointer"
                          onClick={() => {
                            setNewEvent((prev) => ({ ...prev, client_name: client.name }))
                            setClientSearchTerm(client.name)
                            setShowClientSuggestions(false)
                          }}
                        >
                          {client.name}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Input id="type" value={newEvent.type} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={handleInputChange}
                rows={3}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="color" className="text-right">
                Color
              </Label>
              <input
                id="color"
                type="color"
                value={newEvent.color}
                onChange={handleInputChange}
                className="w-full h-8 col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setOpenAddEventModal(false)
                setSelectedEvent(null)
                setNewEvent({
                  title: "",
                  date: format(selectedDate, "yyyy-MM-dd"),
                  startTime: "09:00",
                  endTime: "10:00",
                  description: "",
                  type: "meeting",
                  location: "",
                  color: "#2660ff",
                  client_name: "",
                  source: "Manual",
                })
              }}
            >
              Cancel
            </Button>
            <Button onClick={selectedEvent ? handleUpdateEvent : handleCreateNewEvent}>
              {selectedEvent ? "Save Changes" : "Create Event"}
            </Button>
            {selectedEvent && (
              <Button variant="destructive" onClick={handleDeleteEvent}>
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
