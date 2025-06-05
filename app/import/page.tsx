"use client"

import { useState, ChangeEvent, useCallback, useEffect } from "react"
import { FileText, CheckSquare, Calendar as CalendarIcon, Mail, Plus, HelpCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { parse, isValid, addMinutes, addHours } from "date-fns"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

interface TaskInsert {
  user_id: string
  title: string
  priority: "High" | "Medium" | "Low"
  status: "Not Started" | "In Progress" | "Pending" | "Completed"
  description?: string | null
  due_date?: string | null
  client_name?: string | null
  client_id?: number | null
  assigned_to_name?: string | null
  assigned_to_avatar?: string | null
  assigned_to_initials?: string | null
  progress?: number
  tags?: string[] | null
  source?: string
}

interface CalendarEventInsert {
  title: string
  date: string
  color: string
  type: string
  end_time: string
  description?: string | null
  client_name?: string | null
  location?: string | null
  source?: string
}

interface ImportedNote {
  id: number
  user_id: string
  content: string
  import_date: string
  processed: boolean
  extracted_items: {
    tasks: number[]
    events: number[]
    emails: number[]
  }
  created_at: string
  updated_at: string
}

const MAX_RETRIES = 3
const RETRY_DELAY = 1000

const ImportNotesCard = () => {
  const [inputText, setInputText] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const { toast } = useToast()
  const [importHistory, setImportHistory] = useState<ImportedNote[]>([])

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()
        if (error) throw error
        setUser(supabaseUser)
      } catch (error) {
        console.error("Error fetching user:", error)
        toast({
          title: "Authentication Error",
          description: "Failed to fetch user information",
          variant: "destructive"
        })
      } finally {
        setUserLoading(false)
      }
    }
    fetchUser()
  }, [toast])

  const fetchImportHistory = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('imported_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('import_date', { ascending: false })
        .limit(10)

      if (error) throw error
      setImportHistory(data || [])
    } catch (error) {
      console.error("Error fetching import history:", error)
      toast({
        title: "Error",
        description: "Failed to load import history",
        variant: "destructive"
      })
    }
  }, [user?.id, toast])

  useEffect(() => {
    fetchImportHistory()
  }, [fetchImportHistory])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setFileName(null)
      setInputText("")
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        setInputText(text)
      }
    }
    reader.readAsText(file)
  }

  const isValidEvent = (event: CalendarEventInsert): boolean => {
    try {
      if (!event.title || !event.date || !event.end_time) return false
      const start = new Date(event.date)
      const end = new Date(event.end_time)
      return isValid(start) && isValid(end) && start < end
    } catch {
      return false
    }
  }

  const insertWithRetry = async (
    table: string,
    data: any,
    retries = MAX_RETRIES
  ): Promise<{ data: any, error: any }> => {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .insert([data])
        .select('id')
        .single()

      if (!error) return { data: result, error: null }

      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return insertWithRetry(table, data, retries - 1)
      }

      return { data: null, error }
    } catch (error) {
      return { data: null, error }
    }
  }

  const processImport = useCallback(async () => {
    if (!inputText.trim()) {
      toast({
        title: "Empty Input",
        description: "Please enter or upload notes to import",
        variant: "destructive"
      })
      return
    }

    if (userLoading || !user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please wait while we verify your session",
        variant: "default"
      })
      return
    }

    setIsProcessing(true)
    const lines = inputText.split("\n").filter(line => line.trim() !== "")
    const extractedTaskIds: number[] = []
    const extractedEventIds: number[] = []
    const extractedEmailIds: number[] = []

    let eventsCreated = 0
    let tasksCreated = 0
    let skippedItems = 0

    for (const line of lines) {
      try {
        const trimmedLine = line.trim()
        const content = trimmedLine.startsWith("- ") ? trimmedLine.substring(2) : trimmedLine

        // Enhanced date parsing with multiple format support
        const dateFormats = [
          "yyyy-MM-dd HH:mm",
          "MM/dd/yyyy HH:mm",
          "dd-MM-yyyy HH:mm",
          "EEE, MMM dd, yyyy HH:mm",
          "yyyy-MM-dd",
          "MM/dd/yyyy",
          "dd-MM-yyyy"
        ]

        let parsedDate: Date | null = null
        let extractedTitle = content

        for (const format of dateFormats) {
          const date = parse(content, format, new Date())
          if (isValid(date)) {
            parsedDate = date
            extractedTitle = content.replace(new RegExp(`^${format.split(' ')[0]}\\s*`), '').trim()
            break
          }
        }

        if (parsedDate && isValid(parsedDate)) {
          const endTime = addHours(parsedDate, 1)
          const eventToInsert: CalendarEventInsert = {
            title: extractedTitle || "Imported Event",
            date: parsedDate.toISOString(),
            end_time: endTime.toISOString(),
            color: "#3b82f6",
            type: "Imported",
            description: `Imported from: "${content}"`,
            source: "Note Import"
          }

          if (!isValidEvent(eventToInsert)) {
            skippedItems++
            continue
          }

          const { data: newEvent, error: eventError } = await insertWithRetry('calendar_events', eventToInsert)

          if (eventError) {
            console.error("Event insertion error:", eventError)
            toast({
              title: "Event Error",
              description: `Failed to create event: ${extractedTitle}`,
              variant: "destructive"
            })
          } else if (newEvent?.id) {
            extractedEventIds.push(newEvent.id)
            eventsCreated++
          }
        } else {
          const taskDueDate = new Date()
          taskDueDate.setHours(23, 59, 59, 999)

          const taskToInsert: TaskInsert = {
            user_id: user.id,
            title: content || "Imported Task",
            description: `Imported from: "${content}"`,
            due_date: taskDueDate.toISOString(),
            priority: "Medium",
            status: "Not Started",
            assigned_to_name: user.user_metadata?.full_name || user.email || "User",
            assigned_to_avatar: user.user_metadata?.avatar_url || "",
            assigned_to_initials: (user.user_metadata?.full_name || user.email || "??").substring(0, 2).toUpperCase(),
            progress: 0,
            tags: ["imported"],
            source: "Note Import"
          }

          const { data: newTask, error: taskError } = await insertWithRetry('tasks', taskToInsert)

          if (taskError) {
            console.error("Task insertion error:", taskError)
            toast({
              title: "Task Error",
              description: `Failed to create task: ${content}`,
              variant: "destructive"
            })
          } else if (newTask?.id) {
            extractedTaskIds.push(newTask.id)
            tasksCreated++
          }
        }
      } catch (error) {
        console.error("Error processing line:", error)
        skippedItems++
      }
    }

    // Save import record
    if (eventsCreated > 0 || tasksCreated > 0) {
      const newImportedNote = {
        user_id: user.id,
        content: inputText,
        import_date: new Date().toISOString(),
        processed: true,
        extracted_items: {
          tasks: extractedTaskIds,
          events: extractedEventIds,
          emails: extractedEmailIds
        }
      }

      const { error: importError } = await supabase
        .from('imported_notes')
        .insert([newImportedNote])

      if (importError) {
        console.error("Import record error:", importError)
      }
    }

    // Show summary
    toast({
      title: "Import Complete",
      description: [
        `Created ${eventsCreated} events`,
        `Created ${tasksCreated} tasks`,
        skippedItems > 0 ? `Skipped ${skippedItems} items` : null
      ].filter(Boolean).join(", "),
      variant: "default"
    })

    setInputText("")
    setFileName(null)
    setIsProcessing(false)
    fetchImportHistory()
  }, [inputText, user, userLoading, toast, fetchImportHistory])

  const stats = importHistory.reduce((acc, note) => ({
    tasks: acc.tasks + (note.extracted_items?.tasks?.length || 0),
    events: acc.events + (note.extracted_items?.events?.length || 0),
    emails: acc.emails + (note.extracted_items?.emails?.length || 0)
  }), { tasks: 0, events: 0, emails: 0 })

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
        <div className="flex items-center space-x-3">
          <Plus className="h-6 w-6 text-blue-600" />
          <div>
            <CardTitle className="text-2xl font-bold text-gray-800">Import Notes</CardTitle>
            <CardDescription className="text-gray-600">
              Upload or paste notes to extract tasks and calendar events automatically
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <Label htmlFor="file-upload" className="text-gray-700 font-medium">
            Upload Text File
          </Label>
          <div className="flex items-center space-x-3">
            <Input
              id="file-upload"
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="w-full max-w-md"
            />
            {fileName && (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                {fileName}
              </Badge>
            )}
          </div>
        </div>

        <div className="relative">
          <Textarea
            placeholder={`Enter your notes here (one per line). Examples:
• 2025-06-15 14:30 Team meeting
• 06/20/2025 Project deadline
• Follow up with client`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={8}
            className="w-full min-h-[200px] border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={() => toast({
              title: "Formatting Guide",
              description: [
                "For events: Start with a date (YYYY-MM-DD, MM/DD/YYYY, etc.)",
                "For tasks: Just enter the task text",
                "Examples:",
                "• 2025-06-15 14:30 Team meeting → Creates calendar event",
                "• Buy office supplies → Creates task due today"
              ].join("\n"),
              duration: 10000
            })}
            className="absolute top-3 right-3 text-gray-400 hover:text-blue-500 transition-colors"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="px-3 py-1">
              <FileText className="h-4 w-4 mr-2 text-blue-500" />
              {importHistory.length} imports
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <CheckSquare className="h-4 w-4 mr-2 text-green-500" />
              {stats.tasks} tasks
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              <CalendarIcon className="h-4 w-4 mr-2 text-purple-500" />
              {stats.events} events
            </Badge>
          </div>
          <Button
            onClick={processImport}
            disabled={isProcessing || !inputText.trim() || userLoading || !user}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-sm transition-colors w-full sm:w-auto"
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Import Notes"
            )}
          </Button>
        </div>

        {importHistory.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Recent Imports</h3>
            <div className="space-y-3">
              {importHistory.slice(0, 3).map((note) => (
                <Card key={note.id} className="border border-gray-200 hover:border-blue-200 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500">
                          {new Date(note.import_date).toLocaleString()}
                        </p>
                        <p className="text-gray-700 line-clamp-2 mt-1">
                          {note.content.split('\n')[0]}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {note.extracted_items.tasks.length > 0 && (
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            {note.extracted_items.tasks.length} tasks
                          </Badge>
                        )}
                        {note.extracted_items.events.length > 0 && (
                          <Badge variant="outline" className="text-purple-600 border-purple-200">
                            {note.extracted_items.events.length} events
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const StatsCard = ({ icon, title, value, description, color }: {
  icon: React.ReactNode
  title: string
  value: number
  description: string
  color: string
}) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
      <div className={`p-2 rounded-lg bg-${color}-100 text-${color}-600`}>
        {icon}
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </CardContent>
  </Card>
)

const ImportPage = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalImports: 0,
    totalTasks: 0,
    totalEvents: 0,
    totalEmails: 0
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser()
        setUser(supabaseUser)

        if (supabaseUser?.id) {
          const { count: imports } = await supabase
            .from('imported_notes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', supabaseUser.id)

          const { data: notes } = await supabase
            .from('imported_notes')
            .select('extracted_items')
            .eq('user_id', supabaseUser.id)

          const taskCount = notes?.reduce((acc, note) => acc + (note.extracted_items?.tasks?.length || 0), 0) || 0
          const eventCount = notes?.reduce((acc, note) => acc + (note.extracted_items?.events?.length || 0), 0) || 0

          setStats({
            totalImports: imports || 0,
            totalTasks: taskCount,
            totalEvents: eventCount,
            totalEmails: 0 // Placeholder for future email functionality
          })
        }
      } catch (error) {
        console.error("Error loading page data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 p-4 md:p-8 pt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[110px] w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="md:hidden">
          <MobileNav />
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Note Importer</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            icon={<FileText className="h-4 w-4" />}
            title="Total Imports"
            value={stats.totalImports}
            description="Notes processed"
            color="blue"
          />
          <StatsCard
            icon={<CheckSquare className="h-4 w-4" />}
            title="Tasks Created"
            value={stats.totalTasks}
            description="From all imports"
            color="green"
          />
          <StatsCard
            icon={<CalendarIcon className="h-4 w-4" />}
            title="Events Scheduled"
            value={stats.totalEvents}
            description="Calendar entries"
            color="purple"
          />
          <StatsCard
            icon={<Mail className="h-4 w-4" />}
            title="Emails Drafted"
            value={stats.totalEmails}
            description="Prepared messages"
            color="orange"
          />
        </div>

        <ImportNotesCard />
      </div>
    </div>
  )
}

export default ImportPage
