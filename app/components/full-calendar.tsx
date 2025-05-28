"use client";

import React from "react";
import { format, isSameDay, startOfDay } from "date-fns";
import { CalendarEvent } from "@/lib/types";

// Define the props interface
interface CalendarViewProps {
  events: CalendarEvent[];
  selectedDate?: Date;
}

// Time slots from 8am to 7pm
const timeSlots = Array.from({ length: 12 }, (_, i) => i + 8); // 8, 9, ..., 19

export function CalendarView({ events, selectedDate = new Date() }: CalendarViewProps) {
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

  const timedEvents = dayEvents.filter((event) => {
    const eventDate = new Date(event.date);
    const eventEnd = new Date(event.endTime);
    const startOfDayDate = startOfDay(selectedDate);
    return !(
      isSameDay(eventDate, selectedDate) &&
      isSameDay(eventEnd, selectedDate) &&
      eventDate.getHours() === 0 &&
      eventDate.getMinutes() === 0 &&
      eventEnd.getHours() === 23 &&
      eventEnd.getMinutes() === 59
    );
  });

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
    <div className="relative h-[600px] border rounded-md overflow-hidden">
      {/* All Day Events */}
      {allDayEvents.length > 0 && (
        <div className="p-2 bg-muted/30 border-b">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">All Day</h3>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-md px-2 py-1 text-xs text-white"
                style={{ backgroundColor: event.color }}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timed Events Grid */}
      <div className="relative flex-1">
        {timeSlots.map((hour) => {
          const hourEvents = getHourEventsWithLayout(hour);
          return (
            <div
              key={hour}
              className="grid grid-cols-12 border-b last:border-b-0 relative"
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
              <div className="col-span-10 border-l relative">
                {hourEvents.map((event) => {
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
                      className="absolute rounded-md p-1 text-xs text-white overflow-hidden"
                      style={{
                        backgroundColor: event.color,
                        top: `${topRatio * 100}%`,
                        height: `calc(${heightRatio * 100}% - 2px)`,
                        left: `${horizontalOffsetPercentage}%`,
                        width: `calc(${eventWidthPercentage}% - 2px)`,
                        wordBreak: "break-word",
                      }}
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-ellipsis overflow-hidden text-[10px]">
                        {format(eventStart, "h:mm a")} - {format(eventEnd, "h:mm a")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
