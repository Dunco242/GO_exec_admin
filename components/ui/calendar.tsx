"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "flex justify-between pb-2",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] px-0 py-1",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        // Custom navigation buttons
        CaptionLabel: ({ children }) => (
          <div className="text-sm font-medium">{children}</div>
        ),

        // Customize navigation buttons (prev/next)
        Nav: () => (
          <div className="flex justify-between">
            <button
              className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 p-0 opacity-50 hover:opacity-100")}
              aria-label="Go to previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 p-0 opacity-50 hover:opacity-100")}
              aria-label="Go to next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ),

        // Customize day button
        Day: ({ day, children, ...props }: React.ComponentProps<typeof DayPicker.Day>) => (
          <button
            {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            className="h-9 w-9 text-center text-sm p-0 relative"
          >
            {children}
          </button>
        ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
