"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, FileText, Trash2, Edit, Upload, Calendar as CalendarIcon, ListTodo, MoreHorizontal } from "lucide-react";
import NoteImportModal from "app/components/NoteImportModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: "note" | "task" | "calendar_event";
  due_date?: string | null;
  is_completed?: boolean | null;
  tags?: string[] | null;
  related_task_id?: number | null;
  related_event_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: number;
  title: string;
}
interface CalendarEvent {
  id: number;
  title: string;
  date: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showCreateEditModal, setShowCreateEditModal] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Form states
  const [newNoteTitle, setNewNoteTitle] = useState<string>("");
  const [newNoteContent, setNewNoteContent] = useState<string>("");
  const [newNoteType, setNewNoteType] = useState<"note" | "task" | "calendar_event">("note");
  const [newNoteDueDate, setNewNoteDueDate] = useState<Date | null>(null);
  const [newNoteIsCompleted, setNewNoteIsCompleted] = useState<boolean>(false);
  const [newNoteTags, setNewNoteTags] = useState<string>(""); // comma-separated string
  const [newNoteRelatedTaskId, setNewNoteRelatedTaskId] = useState<number | null>(null);
  const [newNoteRelatedEventId, setNewNoteRelatedEventId] = useState<number | null>(null);
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "note" | "task" | "calendar_event">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<"latest" | "oldest" | "type" | "title">("latest");

  const { toast } = useToast();

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("User not authenticated:", userError?.message);
        toast({
          title: "Authentication Error",
          description: "Please log in to view notes.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setNotes(data as Note[]);
    } catch (error: any) {
      console.error("Error fetching notes:", error.message);
      toast({ title: "Error fetching notes", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const [{ data: tasksData }, { data: eventsData }] = await Promise.all([
        supabase.from("tasks").select("id, title").eq("user_id", currentUserId),
        supabase.from("calendar_events").select("id, title, date").eq("user_id", currentUserId),
      ]);

      setAllTasks(tasksData || []);
      setAllEvents(eventsData || []);
    } catch (error: any) {
      console.error("Error fetching related data:", error.message);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchRelatedData();
    }
  }, [currentUserId, fetchRelatedData]);

  // Reset form when modal closes
  const resetFormStates = () => {
    setNewNoteTitle("");
    setNewNoteContent("");
    setNewNoteType("note");
    setNewNoteDueDate(null);
    setNewNoteIsCompleted(false);
    setNewNoteTags("");
    setNewNoteRelatedTaskId(null);
    setNewNoteRelatedEventId(null);
  };

  const handleCreateNote = () => {
    setEditingNote(null);
    resetFormStates();
    setShowCreateEditModal(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNewNoteTitle(note.title);
    setNewNoteContent(note.content);
    setNewNoteType(note.type);
    setNewNoteDueDate(note.due_date ? parseISO(note.due_date) : null);
    setNewNoteIsCompleted(!!note.is_completed);
    setNewNoteTags((note.tags ?? []).join(", "));
    setNewNoteRelatedTaskId(note.related_task_id ?? null);
    setNewNoteRelatedEventId(note.related_event_id ?? null);
    setShowCreateEditModal(true);
  };

  const handleSaveNote = async () => {
    if (!currentUserId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    if (!newNoteTitle.trim()) {
      toast({ title: "Validation Error", description: "Note title cannot be empty.", variant: "destructive" });
      return;
    }

    setIsSavingNote(true);
    try {
      const tagsArray = newNoteTags.split(",").map(tag => tag.trim()).filter(Boolean);
      const noteData = {
        user_id: currentUserId,
        title: newNoteTitle,
        content: newNoteContent,
        type: newNoteType,
        due_date: newNoteDueDate ? format(newNoteDueDate, 'yyyy-MM-dd') : null,
        is_completed: newNoteIsCompleted,
        tags: tagsArray.length > 0 ? tagsArray : null,
        related_task_id: newNoteRelatedTaskId,
        related_event_id: newNoteRelatedEventId,
        updated_at: new Date().toISOString(),
      };

      if (editingNote) {
        const { error } = await supabase
          .from("notes")
          .update(noteData)
          .eq("id", editingNote.id)
          .eq("user_id", currentUserId);
        if (error) throw error;
        toast({ title: "Note Updated", description: "Your note has been successfully updated." });
      } else {
        const { error } = await supabase.from("notes").insert({
          ...noteData,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
        toast({ title: "Note Created", description: "Your new note has been successfully created." });
      }

      fetchNotes();
      setShowCreateEditModal(false);
    } catch (error: any) {
      console.error("Error saving note:", error.message);
      toast({ title: "Error saving note", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!currentUserId) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    if (confirm("Are you sure you want to delete this note?")) {
      try {
        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", noteId)
          .eq("user_id", currentUserId);
        if (error) throw error;
        toast({ title: "Note Deleted", description: "The note has been successfully deleted." });
        fetchNotes();
      } catch (error: any) {
        console.error("Error deleting note:", error.message);
        toast({ title: "Error deleting note", description: error.message, variant: "destructive" });
      }
    }
  };

  // Extract unique tags from all notes
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach(note => {
      if (note.tags) note.tags.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet);
  }, [notes]);

  // Apply filters and sorting
  const filteredAndSortedNotes = useMemo(() => {
    let result = [...notes];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        note =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType !== "all") {
      result = result.filter(note => note.type === filterType);
    }

    // Status filter (only for tasks)
    if (filterStatus !== "all") {
      result = result.filter(note => {
        if (note.type !== "task") return true;
        return filterStatus === "completed"
          ? note.is_completed
          : !note.is_completed;
      });
    }

    // Tag filter
    if (selectedTags.length > 0) {
      result = result.filter(note =>
        note.tags?.some(tag => selectedTags.includes(tag))
      );
    }

    // Sort
    switch (sortOption) {
      case "latest":
        result.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        break;
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        );
        break;
      case "type":
        result.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case "title":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [notes, searchQuery, filterType, filterStatus, selectedTags, sortOption]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading notes...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">My Notes</h1>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-56"
          />
          <Button onClick={() => setShowImportModal(true)} variant="outline" size="sm" className="w-full sm:w-auto">
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button onClick={handleCreateNote} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> New Note
          </Button>
        </div>
      </div>

      {/* Filters & Sort Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <Label>Type</Label>
          <Select
            value={filterType}
            onValueChange={(value) => setFilterType(value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="calendar_event">Calendar Event</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Status</Label>
          <Select
            value={filterStatus}
            onValueChange={(value) => setFilterStatus(value as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Tag</Label>
          <Select
            onValueChange={(value) => {
              const tags = value === "none" ? [] : [...selectedTags, value];
              setSelectedTags([...new Set(tags)]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Tags" />
            </SelectTrigger>
            <SelectContent>
              {allTags.length === 0 ? (
                <SelectItem value="none" disabled>No tags available</SelectItem>
              ) : (
                allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    #{tag}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Sort By</Label>
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort notes..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="type">By Type</SelectItem>
              <SelectItem value="title">By Title</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clear Filters Button */}
      {(searchQuery || filterType !== "all" || filterStatus !== "all" || selectedTags.length > 0) && (
        <div className="flex justify-end mt-2">
          <Button
            variant="ghost"
            onClick={() => {
              setSearchQuery("");
              setFilterType("all");
              setFilterStatus("all");
              setSelectedTags([]);
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        {currentUserId && (
          <NoteImportModal
            userId={currentUserId}
            onImportSuccess={fetchNotes}
            onClose={() => setShowImportModal(false)}
          />
        )}
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateEditModal} onOpenChange={setShowCreateEditModal}>
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Note" : "Create New Note"}</DialogTitle>
            <DialogDescription>{editingNote ? "Modify your note content." : "Enter details for your new note."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Type</Label>
              <RadioGroup
                value={newNoteType}
                onValueChange={(value: "note" | "task" | "calendar_event") => setNewNoteType(value)}
                className="flex items-center space-x-4 col-span-3"
              >
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="note" id="type-note" />
                  <Label htmlFor="type-note">Note</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="task" id="type-task" />
                  <Label htmlFor="type-task">Task</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="calendar_event" id="type-event" />
                  <Label htmlFor="type-event">Calendar Event</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title</Label>
              <Input
                id="title"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Note title"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="content" className="text-right pt-2">Content</Label>
              <Textarea
                id="content"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                rows={6}
                placeholder="Note content..."
                className="col-span-3 resize-y"
              />
            </div>

            {(newNoteType === "task" || newNoteType === "calendar_event") && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dueDate" className="text-right">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !newNoteDueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newNoteDueDate ? format(newNoteDueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newNoteDueDate || undefined}
                      onSelect={(date: Date | undefined) => setNewNoteDueDate(date || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {newNoteType === "task" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isCompleted" className="text-right">Completed</Label>
                <Checkbox
                  id="isCompleted"
                  checked={newNoteIsCompleted}
                  onCheckedChange={(checked) => setNewNoteIsCompleted(!!checked)}
                  className="col-span-3"
                />
              </div>
            )}

            {(newNoteType === "task" || newNoteType === "calendar_event") && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tags" className="text-right">Tags</Label>
                <Input
                  id="tags"
                  value={newNoteTags}
                  onChange={(e) => setNewNoteTags(e.target.value)}
                  placeholder="e.g., urgent, client"
                  className="col-span-3"
                />
              </div>
            )}

            {newNoteType === "task" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="relatedTask" className="text-right">Related Task</Label>
                <Select
                  value={newNoteRelatedTaskId?.toString() || ""}
                  onValueChange={(value) => setNewNoteRelatedTaskId(parseInt(value))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Link to task" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTasks.length === 0 ? (
                      <SelectItem disabled value="none">No tasks available</SelectItem>
                    ) : (
                      allTasks.map(task => (
                        <SelectItem key={task.id} value={task.id.toString()}>
                          {task.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {newNoteType === "calendar_event" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="relatedEvent" className="text-right">Related Event</Label>
                <Select
                  value={newNoteRelatedEventId?.toString() || ""}
                  onValueChange={(value) => setNewNoteRelatedEventId(parseInt(value))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Link to event" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEvents.length === 0 ? (
                      <SelectItem disabled value="none">No events available</SelectItem>
                    ) : (
                      allEvents.map(event => (
                        <SelectItem key={event.id} value={event.id.toString()}>
                          {event.title} ({format(parseISO(event.date), "MMM d, yyyy")})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreateEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={isSavingNote}>
              {isSavingNote ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Grid */}
      {filteredAndSortedNotes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No notes found</h3>
          <p className="mt-1 text-sm text-gray-500">Try changing your filters or create a new note.</p>
          <div className="mt-4">
            <Button onClick={handleCreateNote} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Create One
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedNotes.map((note) => (
            <Card key={note.id} className="shadow-md hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  {note.type === "task" && <ListTodo className="mr-2 h-4 w-4 text-green-500" />}
                  {note.type === "calendar_event" && <CalendarIcon className="mr-2 h-4 w-4 text-purple-500" />}
                  {note.title}
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Last updated: {format(parseISO(note.updated_at), "MMM d, yyyy")}
                  {note.type !== "note" && note.due_date && (
                    <span className="ml-2">• Due: {format(parseISO(note.due_date), "MMM d")}</span>
                  )}
                  {note.type === "task" && note.is_completed !== null && (
                    <span className="ml-2">{note.is_completed ? "✅ Completed" : "⏳ Pending"}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm line-clamp-3 text-gray-700">{note.content}</p>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {note.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pb-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditNote(note)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
