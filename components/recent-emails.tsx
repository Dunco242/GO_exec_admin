"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

const emails = [
  {
    id: 1,
    sender: "John Smith",
    subject: "Project Update: Q2 Marketing Campaign",
    preview: "I wanted to share the latest updates on our Q2 marketing campaign...",
    time: "10:23 AM",
    unread: true,
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "JS",
  },
  {
    id: 2,
    sender: "Emily Johnson",
    subject: "Meeting Rescheduled: Client Presentation",
    preview: "Due to some unforeseen circumstances, we need to reschedule our client presentation...",
    time: "9:45 AM",
    unread: true,
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "EJ",
  },
  {
    id: 3,
    sender: "Michael Davis",
    subject: "Invoice #1234 - Payment Confirmation",
    preview: "This email confirms that we've received your payment for Invoice #1234...",
    time: "Yesterday",
    unread: true,
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "MD",
  },
  {
    id: 4,
    sender: "Sarah Wilson",
    subject: "New Task Assignment: Website Content Review",
    preview: "I've assigned you a new task to review the updated website content...",
    time: "Yesterday",
    unread: false,
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "SW",
  },
  {
    id: 5,
    sender: "Robert Brown",
    subject: "Quarterly Review Meeting",
    preview: "Just a reminder about our quarterly review meeting scheduled for next week...",
    time: "May 15",
    unread: false,
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "RB",
  },
]

export function RecentEmails() {
  return (
    <div className="space-y-4">
      {emails.map((email) => (
        <div
          key={email.id}
          className={`flex items-start space-x-4 rounded-md p-3 transition-colors hover:bg-muted/50 ${
            email.unread ? "bg-muted/30" : ""
          }`}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={email.avatar || "/placeholder.svg"} alt={email.sender} />
            <AvatarFallback>{email.initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-medium">{email.sender}</div>
              <div className="text-xs text-muted-foreground">{email.time}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{email.subject}</div>
              {email.unread && (
                <Badge variant="default" className="bg-[#2660ff]">
                  New
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-1">{email.preview}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
