"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, FileText, Check, X, Calendar, Mail, CheckSquare } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { parseNote } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { parse } from "date-fns"

export function ImportNotes() {
  const [notes, setNotes] = useState<string>("")
  const [parsedNotes, setParsedNotes] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<string>("import")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Access store actions
  const { addTask, addEvent, addEmail, addImportedNote } = useStore()

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== "text/plain") {
      toast({
        title: "Invalid file type",
        description: "Please upload a .txt file",
        variant: "destructive",
      })
      return
    }

    try {
      const text = await file.text()
      setNotes(text)
      toast({
        title: "File uploaded",
        description: `Successfully uploaded ${file.name}`,
      })
    } catch (error) {
      toast({
        title: "Error reading file",
        description: "There was an error reading the file",
        variant: "destructive",
      })
    }
  }

  // Parse notes into structured data
  const handleParseNotes = () => {
    if (!notes.trim()) {
      toast({
        title: "No notes to parse",
        description: "Please enter or upload notes first",
        variant: "destructive",
      })
      return
    }

    // Split notes by bullet points or new lines
    const noteLines = notes
      .split(/[\n•]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    // Parse each note
    const parsed = noteLines.map((note) => ({
      original: note,
      parsed: parseNote(note),
    }))

    setParsedNotes(parsed)
    setActiveTab("review")

    toast({
      title: "Notes parsed",
      description: `Successfully parsed ${parsed.length} notes`,
    })
  }

  // Process the parsed notes into tasks, events, and emails
  const handleProcessNotes = () => {
    if (parsedNotes.length === 0) {
      toast({
        title: "No parsed notes",
        description: "Please parse notes first",
        variant: "destructive",
      })
      return
    }

    const noteId = addImportedNote({
      content: notes,
      importDate: new Date(),
      processed: true,
      extractedItems: {
        tasks: [],
        events: [],
        emails: [],
      },
    })

    const extractedItems = {
      tasks: [] as number[],
      events: [] as number[],
      emails: [] as number[],
    }

    // Process each parsed note
    parsedNotes.forEach(({ original, parsed }) => {
      const { title, description, dueDate, dueTime, client, actionType, priority } = parsed

      // Common properties
      const commonProps = {
        title,
        description,
        client: client || "Unknown",
        source: `Imported note #${noteId}`,
      }

      // Create appropriate item based on action type
      if (actionType === "email") {
        // Create an email draft
        const emailId = addEmail({
          recipient: client || "Unknown",
          recipientEmail: "",
          subject: title,
          body: description,
          status: "draft",
          ...commonProps,
        })
        extractedItems.emails.push(emailId)
      } else if (actionType === "meeting" || actionType === "call") {
        // Create a calendar event
        let eventDate = new Date()
        let endTime = new Date()

        if (dueDate) {
          try {
            eventDate = parse(`${dueDate} ${dueTime || "09:00"}`, "MMMM d, yyyy HH:mm", new Date())
            endTime = new Date(eventDate.getTime() + 60 * 60 * 1000) // 1 hour later
          } catch (e) {
            console.error("Error parsing date:", e)
          }
        }

        const eventId = addEvent({
          date: eventDate,
          endTime: endTime,
          type: actionType,
          location: actionType === "call" ? "Phone" : "To be determined",
          ...commonProps,
        })
        extractedItems.events.push(eventId)
      } else {
        // Create a task
        const formattedDueDate = dueDate ? (dueTime ? `${dueDate}, ${dueTime}` : dueDate) : "No deadline"

        const taskId = addTask({
          dueDate: formattedDueDate,
          priority,
          status: "Not Started",
          assignedTo: {
            name: "Sarah Johnson",
            avatar: "/placeholder.svg?height=40&width=40",
            initials: "SJ",
          },
          progress: 0,
          tags: [actionType],
          ...commonProps,
        })
        extractedItems.tasks.push(taskId)
      }
    })

    // Update the imported note with the extracted items
    useStore.getState().updateImportedNote(noteId, {
      extractedItems,
    })

    // Reset state and show success message
    setNotes("")
    setParsedNotes([])
    setActiveTab("import")

    toast({
      title: "Notes processed",
      description: `Created ${extractedItems.tasks.length} tasks, ${extractedItems.events.length} events, and ${extractedItems.emails.length} emails`,
    })
  }

  return (
    <Card className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Import Notes</CardTitle>
              <CardDescription>Import and process text notes to create tasks, events, and emails</CardDescription>
            </div>
            <TabsList>
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="review" disabled={parsedNotes.length === 0}>
                Review
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>

        <TabsContent value="import">
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Enter or upload notes</h3>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload .txt
                  </Button>
                  <input type="file" ref={fileInputRef} accept=".txt" className="hidden" onChange={handleFileUpload} />
                </div>
              </div>

              <Textarea
                placeholder="Enter your notes here. Each bullet point or line will be processed as a separate item.
                
Example:
• Email John Doe on Tuesday 6th June about supply chain issues
• Schedule meeting with marketing team next Monday at 2pm
• Call Sarah from XYZ Inc tomorrow regarding the contract renewal"
                className="min-h-[300px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="text-sm text-muted-foreground">
                <p>Notes should include:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Action (email, call, meet, review, etc.)</li>
                  <li>Person or client name</li>
                  <li>Date and time (if applicable)</li>
                  <li>Subject or topic</li>
                </ul>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setNotes("")}>
              Clear
            </Button>
            <Button onClick={handleParseNotes} disabled={!notes.trim()}>
              <FileText className="mr-2 h-4 w-4" />
              Parse Notes
            </Button>
          </CardFooter>
        </TabsContent>

        <TabsContent value="review">
          <CardContent>
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Review parsed notes</h3>

              {parsedNotes.map((item, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2 bg-muted/50">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{item.parsed.title}</CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className={`
                          ${
                            item.parsed.priority === "High"
                              ? "border-red-500 text-red-500"
                              : item.parsed.priority === "Medium"
                                ? "border-amber-500 text-amber-500"
                                : "border-green-500 text-green-500"
                          }
                        `}
                      >
                        {item.parsed.priority}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2">
                    <div className="text-sm text-muted-foreground mb-3">{item.original}</div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium">Action Type</p>
                        <div className="flex items-center mt-1">
                          {item.parsed.actionType === "email" ? (
                            <Mail className="h-4 w-4 mr-2 text-[#2660ff]" />
                          ) : item.parsed.actionType === "meeting" ? (
                            <Calendar className="h-4 w-4 mr-2 text-[#2660ff]" />
                          ) : (
                            <CheckSquare className="h-4 w-4 mr-2 text-[#2660ff]" />
                          )}
                          <span className="capitalize">{item.parsed.actionType}</span>
                        </div>
                      </div>

                      <div>
                        <p className="font-medium">Client</p>
                        <p className="mt-1">{item.parsed.client || "Not specified"}</p>
                      </div>

                      <div>
                        <p className="font-medium">Due Date</p>
                        <p className="mt-1">{item.parsed.dueDate || "Not specified"}</p>
                      </div>

                      <div>
                        <p className="font-medium">Due Time</p>
                        <p className="mt-1">{item.parsed.dueTime || "Not specified"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab("import")}>
              <X className="mr-2 h-4 w-4" />
              Back to Import
            </Button>
            <Button onClick={handleProcessNotes}>
              <Check className="mr-2 h-4 w-4" />
              Process Notes
            </Button>
          </CardFooter>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
