"use client";

import React from "react";
import { format, isSameDay, startOfDay, addDays } from "date-fns";
import { CalendarEvent } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Define time slots from 8am to 7pm
const timeSlots = Array.from({ length: 12 }, (_, i) => i + 8); // 8, 9, ..., 19

interface CalendarViewProps {
  events: CalendarEvent[];
  selectedDate?: Date;
}

/**
 * CalendarView - Renders a day-based calendar view with time slots and event layout
 */
export function CalendarView({ events, selectedDate = new Date(), onDateChange }: CalendarViewProps & { onDateChange?: (date: Date) => void }) {
  const dayEvents = events.filter((event) =>
    isSameDay(new Date(event.date), selectedDate)
  );

  const allDayEvents = dayEvents.filter((event) => {
    const eventDate = new Date(event.date);
    const eventEnd = new Date(event.endTime);
    const startOfDayDate = startOfDay(selectedDate);
    return (
      isSameDay(eventDate, selectedDate) &&
      isSameDay(eventEnd, selectedDate) &&
      eventDate.getHours() === 0 &&
      eventDate.getMinutes() === 0 &&
      eventEnd.getHours() === 23 &&
      eventEnd.getMinutes() === 59
    );
  });

  const timedEvents = dayEvents.filter((event) => !allDayEvents.includes(event));

  const getHourEventsWithLayout = (hour: number) => {
    const hourStart = new Date(selectedDate);
    hourStart.setHours(hour, 0, 0, 0);
    const hourEnd = new Date(selectedDate);
    hourEnd.setHours(hour + 1, 0, 0, 0);

    const eventsInHour = timedEvents.filter((event) => {
      const eventStart = new Date(event.date);
      const eventEnd = new Date(event.endTime);
      return eventStart < hourEnd && eventEnd > hourStart;
    });

    if (eventsInHour.length === 0) return [];

    const layouts: { [eventId: number]: { column: number; totalColumns: number } } = {};
    const columns: { end: Date }[] = [];

    eventsInHour.forEach((event) => {
      let placed = false;
      const eventStart = new Date(event.date);
      const eventEnd = new Date(event.endTime);

      for (let i = 0; i < columns.length; i++) {
        if (eventStart >= columns[i].end) {
          layouts[event.id] = { column: i, totalColumns: columns.length };
          columns[i].end = eventEnd;
          placed = true;
          break;
        }
      }

      if (!placed) {
        layouts[event.id] = { column: columns.length, totalColumns: columns.length + 1 };
        columns.push({ end: eventEnd });
      }
    });

    return eventsInHour.map((event) => ({
      ...event,
      layout: layouts[event.id],
    }));
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{format(selectedDate, "MMMM d, yyyy")}</CardTitle>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => {
            const prevDay = addDays(selectedDate, -1);
            onDateChange?.(prevDay);
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => {
            const nextDay = addDays(selectedDate, 1);
            onDateChange?.(nextDay);
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-[500px] overflow-y-auto relative">
        {/* All Day Events */}
        {allDayEvents.length > 0 && (
          <div className="mb-2 border-b pb-2">
            <div className="font-medium text-sm text-muted-foreground">All Day</div>
            <div className="flex flex-col space-y-1 mt-1">
              {allDayEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-md p-1 text-xs text-white overflow-hidden"
                  style={{ backgroundColor: event.color, wordBreak: 'break-word' }}
                >
                  {event.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timed Events Grid */}
        <div className="relative h-full">
          {timeSlots.map((hour) => {
            const hourEventsWithLayout = getHourEventsWithLayout(hour);
            return (
              <div
                key={hour}
                className="grid grid-cols-12 border-b"
                style={{
                  height: `${(1 / 11) * 100}%`,
                  top: `${((hour - 8) / 11) * 100}%`,
                  position: "absolute" as const,
                  width: "100%",
                }}
              >
                {/* Time Label Column */}
                <div className="col-span-2 text-right pr-2 text-xs text-muted-foreground flex items-center justify-end h-full">
                  {hour % 12 === 0 ? 12 : hour % 12}{hour < 12 ? "AM" : "PM"}
                </div>

                {/* Event Area Column */}
                <div className="col-span-10 p-1 border-l relative">
                  {hourEventsWithLayout.map((event) => {
                    const eventStart = new Date(event.date);
                    const eventEnd = new Date(event.endTime);
                    const startMinutes =
                      (eventStart.getHours() - 8) * 60 + eventStart.getMinutes();
                    const durationMinutes =
                      (eventEnd.getHours() * 60 + eventEnd.getMinutes()) -
                      (eventStart.getHours() * 60 + eventStart.getMinutes());
                    const topRatio = startMinutes / (11 * 60);
                    const heightRatio = durationMinutes / (11 * 60);
                    const totalColumns = event.layout?.totalColumns || 1;
                    const column = event.layout?.column || 0;
                    const eventWidthPercentage = 100 / totalColumns;
                    const horizontalOffsetPercentage = column * eventWidthPercentage;

                    return (
                      <div
                        key={event.id}
                        className="absolute rounded-md p-1 mb-1 text-xs text-white overflow-hidden cursor-pointer"
                        style={{
                          backgroundColor: event.color,
                          top: `${topRatio * 100}%`,
                          height: `calc(${heightRatio * 100}% - 2px)`,
                          left: `${horizontalOffsetPercentage}%`,
                          width: `calc(${eventWidthPercentage}% - 2px)`,
                          wordBreak: 'break-word',
                        }}
                      >
                        <div className="font-medium">{event.title}</div>
                        <div>{format(eventStart, "h:mm a")} - {format(eventEnd, "h:mm a")}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
