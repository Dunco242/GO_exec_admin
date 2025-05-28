import { create } from "zustand"
import { persist } from "zustand/middleware"

// Define types for our data
export type Client = {
  id: number
  name: string
  contactName: string
  email: string
  phone: string
  status: string
  type: string
  industry: string
  lastContact: string
  avatar: string
  initials: string
}

export type Task = {
  id: number
  title: string
  description: string
  dueDate: string
  dueTime?: string
  priority: string
  status: string
  client: string
  assignedTo: {
    name: string
    avatar: string
    initials: string
  }
  progress: number
  tags: string[]
  source?: string
}

export type CalendarEvent = {
  id: number
  title: string
  description?: string
  date: Date
  endTime: Date
  client: string
  type: string
  location: string
  source?: string
  color: string
}

export type Email = {
  id: number
  sender: string
  senderEmail: string
  subject: string
  preview: string
  time: string
  date: string
  unread: boolean
  starred: boolean
  avatar: string
  initials: string
  folder: string
  labels: string[]
  attachments: { name: string; size: string; file?: File | null }[]
  body: string
  to: string[]
  cc: string[]
  bcc: string[]
  client_id: number | null
}

export type ImportedNote = {
  id: number
  content: string
  importDate: Date
  processed: boolean
  extractedItems: {
    tasks: number[]
    events: number[]
    emails: number[]
  }
}

// Define the type for Email Settings to be stored in Zustand
export type EmailSettings = {
    mainEmailAddress: string;
    smtpServer: string;
    smtpPort: number;
    imapServer: string;
    imapPort: number;
}

// Define the store
type Store = {
  clients: Client[]
  tasks: Task[]
  events: CalendarEvent[]
  emails: Email[]
  importedNotes: ImportedNote[]
  emailSettings: EmailSettings | null; // Added email settings to the store

  // Actions
  addTask: (task: Omit<Task, "id">) => number
  updateTask: (id: number, task: Partial<Task>) => void
  deleteTask: (id: number) => void

  addEvent: (event: Omit<CalendarEvent, "id">) => number
  updateEvent: (id: number, event: Partial<CalendarEvent>) => void
  deleteEvent: (id: number) => void

  addEmail: (email: Omit<Email, "id">) => number
  updateEmail: (id: number, email: Partial<Email>) => void
  deleteEmail: (id: number) => void

  addImportedNote: (note: Omit<ImportedNote, "id">) => number
  updateImportedNote: (id: number, note: Partial<ImportedNote>) => void
  deleteImportedNote: (id: number) => void

  setEmailSettings: (settings: EmailSettings) => void; // Action to set email settings
}

// Create the store
export const useStore = create<Store>()(
  persist(
    (set) => ({
      clients: [
        {
          id: 1,
          name: "ABC Corporation",
          contactName: "John Smith",
          email: "john.smith@abccorp.com",
          phone: "(555) 123-4567",
          status: "Active",
          type: "Corporate",
          industry: "Technology",
          lastContact: "May 15, 2025",
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "AC",
        },
        {
          id: 2,
          name: "XYZ Inc.",
          contactName: "Emily Johnson",
          email: "emily.johnson@xyzinc.com",
          phone: "(555) 987-6543",
          status: "Active",
          type: "Corporate",
          industry: "Finance",
          lastContact: "May 18, 2025",
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "XI",
        },
      ],
      tasks: [
        {
          id: 1,
          title: "Client call with ABC Corp",
          description: "Discuss project requirements and timeline",
          dueDate: "Today, 2:00 PM",
          dueTime: "14:00",
          priority: "High",
          status: "Pending",
          client: "ABC Corp",
          assignedTo: {
            name: "Sarah Johnson",
            avatar: "/placeholder.svg?height=40&width=40",
            initials: "SJ",
          },
          progress: 0,
          tags: ["meeting", "client"],
        },
        {
          id: 2,
          title: "Prepare quarterly report",
          description: "Compile data and create presentation for quarterly review",
          dueDate: "Today, 5:00 PM",
          dueTime: "17:00",
          priority: "Medium",
          status: "In Progress",
          client: "Internal",
          assignedTo: {
            name: "Sarah Johnson",
            avatar: "/placeholder.svg?height=40&width=40",
            initials: "SJ",
          },
          progress: 60,
          tags: ["report", "internal"],
        },
      ],
      events: [
        {
          id: 1,
          title: "Client Meeting: ABC Corp",
          description: "Discuss project requirements and timeline",
          date: new Date(2025, 4, 20, 10, 0),
          endTime: new Date(2025, 4, 20, 11, 30),
          client: "ABC Corp",
          type: "meeting",
          location: "Zoom",
          source: "calendar",
          color: "#FF5733",
        },
        {
          id: 2,
          title: "Project Review",
          description: "Review project progress and next steps",
          date: new Date(2025, 4, 20, 14, 0),
          endTime: new Date(2025, 4, 20, 15, 0),
          client: "Internal",
          type: "review",
          location: "Office",
          source: "calendar",
          color: "#33FF57",
        },
      ],
      emails: [
        {
          id: 1,
          sender: "John Smith",
          senderEmail: "john.smith@example.com",
          subject: "Project Update",
          preview: "Details of project update.",
          time: "10:00 AM",
          date: "May 20, 2025",
          unread: true,
          starred: false,
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "JS",
          folder: "inbox",
          labels: ["work"],
          attachments: [],
          body: "<p>This is the body of the email.</p>",
          to: ["sarah.wilson@example.com"],
          cc: [],
          bcc: [],
          client_id: null,
        },
        {
          id: 2,
          sender: "Emily Johnson",
          senderEmail: "emily.johnson@example.com",
          subject: "Meeting Reminder",
          preview: "Reminder about the meeting.",
          time: "09:00 AM",
          date: "May 20, 2025",
          unread: true,
          starred: true,
          avatar: "/placeholder.svg?height=40&width=40",
          initials: "EJ",
          folder: "inbox",
          labels: ["meeting"],
          attachments: [],
          body: "<p>This is another email body.</p>",
          to: ["team@example.com"],
          cc: ["manager@example.com"],
          bcc: [],
          client_id: null,
        },
      ],
      importedNotes: [],
      emailSettings: null, // Initialize email settings as null

      // Task actions
      addTask: (task) => {
        let newId = 1
        set((state) => {
          if (state.tasks.length > 0) {
            newId = Math.max(...state.tasks.map((t) => t.id)) + 1
          }
          return { tasks: [...state.tasks, { id: newId, ...task }] }
        })
        return newId
      },

      updateTask: (id, task) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...task } : t)),
        }))
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }))
      },

      // Event actions
      addEvent: (event) => {
        let newId = 1
        set((state) => {
          if (state.events.length > 0) {
            newId = Math.max(...state.events.map((e) => e.id)) + 1
          }
          return { events: [...state.events, { id: newId, ...event }] }
        })
        return newId
      },

      updateEvent: (id, event) => {
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...event } : e)),
        }))
      },

      deleteEvent: (id) => {
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        }))
      },

      // Email actions
      addEmail: (email) => {
        let newId = 1
        set((state) => {
          if (state.emails.length > 0) {
            newId = Math.max(...state.emails.map((e) => e.id)) + 1
          }
          return { emails: [...state.emails, { id: newId, ...email }] }
        })
        return newId
      },

      updateEmail: (id, email) => {
        set((state) => ({
          emails: state.emails.map((e) => (e.id === id ? { ...e, ...email } : e)),
        }))
      },

      deleteEmail: (id) => {
        set((state) => ({
          emails: state.emails.filter((e) => e.id !== id),
        }))
      },

      // Imported note actions
      addImportedNote: (note) => {
        let newId = 1
        set((state) => {
          if (state.importedNotes.length > 0) {
            newId = Math.max(...state.importedNotes.map((n) => n.id)) + 1
          }
          return { importedNotes: [...state.importedNotes, { id: newId, ...note }] }
        })
        return newId
      },

      updateImportedNote: (id, note) => {
        set((state) => ({
          importedNotes: state.importedNotes.map((n) => (n.id === id ? { ...n, ...note } : n)),
        }))
      },

      deleteImportedNote: (id) => {
        set((state) => ({
          importedNotes: state.importedNotes.filter((n) => n.id !== id),
        }))
      },

      // Email settings action
      setEmailSettings: (settings) => {
        set({ emailSettings: settings });
      },
    }),
    {
      name: "va-crm-storage",
    },
  ),
)
