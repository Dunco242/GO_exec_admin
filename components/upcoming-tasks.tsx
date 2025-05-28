"use client"

import { CheckCircle2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const tasks = [
  {
    id: 1,
    title: "Client call with ABC Corp",
    dueDate: "Today, 2:00 PM",
    priority: "High",
    status: "Pending",
    client: "ABC Corp",
  },
  {
    id: 2,
    title: "Prepare quarterly report",
    dueDate: "Today, 5:00 PM",
    priority: "Medium",
    status: "In Progress",
    client: "Internal",
  },
  {
    id: 3,
    title: "Send follow-up emails",
    dueDate: "Tomorrow, 10:00 AM",
    priority: "Medium",
    status: "Not Started",
    client: "Various",
  },
  {
    id: 4,
    title: "Review marketing materials",
    dueDate: "Tomorrow, 3:00 PM",
    priority: "Low",
    status: "Not Started",
    client: "XYZ Inc",
  },
  {
    id: 5,
    title: "Schedule social media posts",
    dueDate: "Tomorrow, 4:30 PM",
    priority: "Medium",
    status: "Not Started",
    client: "Internal",
  },
]

export function UpcomingTasks() {
  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-start space-x-4 rounded-md p-3 transition-colors hover:bg-muted/50">
          <div
            className={`mt-0.5 ${task.status === "In Progress" ? "text-amber-500" : task.status === "Pending" ? "text-[#2660ff]" : "text-gray-400"}`}
          >
            {task.status === "In Progress" ? <Clock className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">{task.title}</p>
              <Badge
                variant="outline"
                className={`
                  ${
                    task.priority === "High"
                      ? "border-red-500 text-red-500"
                      : task.priority === "Medium"
                        ? "border-amber-500 text-amber-500"
                        : "border-green-500 text-green-500"
                  }
                `}
              >
                {task.priority}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{task.dueDate}</p>
              <p className="text-xs font-medium">{task.client}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
