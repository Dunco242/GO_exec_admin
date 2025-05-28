"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabaseClient";
import { format, parseISO, addDays, isSameDay, startOfDay } from "date-fns";
import { CheckCircle2, Clock, AlertCircle, MoreHorizontal, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CalendarView } from "@/app/components/calendar-view"; // Make sure this exists
import { CalendarEvent } from "@/lib/types"; // Ensure interface exists

// Define Task interface matching Supabase schema
interface Task {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "High" | "Medium" | "Low";
  status: "Not Started" | "In Progress" | "Pending" | "Completed";
  client_name: string | null;
  client_id: number | null;
  assigned_to_name: string;
  assigned_to_avatar: string;
  assigned_to_initials: string;
  progress: number;
  tags: string[];
  source: string;
}

export default function TasksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "not-started" | "in-progress" | "pending" | "completed">("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [openAddTaskModal, setOpenAddTaskModal] = useState(false);
  const [openEditTaskModal, setOpenEditTaskModal] = useState(false);
  const [openDeleteConfirmModal, setOpenDeleteConfirmModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskData, setNewTaskData] = useState({
    title: "",
    description: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    dueTime: "09:00",
    priority: "Medium" as const,
    status: "Not Started" as const,
    client_name: "",
    client_id: null as number | null,
    assigned_to_name: "Sarah Johnson",
    assigned_to_avatar: "/placeholder.svg?height=40&width=40",
    assigned_to_initials: "SJ",
    progress: 0,
    tags: "",
    source: "Manual",
  });
  const [editTaskData, setEditTaskData] = useState<{
    id: number;
    title: string;
    description: string;
    dueDate: string;
    dueTime: string;
    priority: "High" | "Medium" | "Low";
    status: "Not Started" | "In Progress" | "Pending" | "Completed";
    client_name: string;
    client_id: number | null;
    assigned_to_name: string;
    assigned_to_avatar: string;
    assigned_to_initials: string;
    progress: number;
    tags: string;
    source: string;
  } | null>(null);
  const [allClients, setAllClients] = useState<{ id: number; name: string }[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterAssignedTo, setFilterAssignedTo] = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentDay, setCurrentDay] = useState(new Date());
  const [mergedEvents, setMergedEvents] = useState<CalendarEvent[]>([]);
  const { toast } = useToast();

  // Get current user ID
  useEffect(() => {
    const getSupabaseUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        console.error("Error fetching user:", error);
        return;
      }
      setUserId(data.user.id);
    };
    getSupabaseUser();
  }, []);

  // Fetch clients for autocomplete
  useEffect(() => {
    const fetchClientsForSearch = async () => {
      try {
        const { data, error } = await supabase.from("clients").select("id, name").order("name", { ascending: true });
        if (error) {
          console.error("Error fetching clients for search:", error.message);
          return;
        }
        setAllClients(data || []);
      } catch (error) {
        console.error("An unexpected error occurred while fetching clients:", error);
      }
    };
    fetchClientsForSearch();
  }, []);

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      if (!userId) return;

      try {
        let query = supabase.from("tasks").select("*").eq("user_id", userId);

        if (activeTab === "not-started") query = query.eq("status", "Not Started");
        else if (activeTab === "in-progress") query = query.eq("status", "In Progress");
        else if (activeTab === "pending") query = query.eq("status", "Pending");
        else if (activeTab === "completed") query = query.eq("status", "Completed");

        if (filterPriority !== "All") query = query.eq("priority", filterPriority);
        if (filterAssignedTo !== "All") query = query.eq("assigned_to_name", filterAssignedTo);
        if (filterSource !== "All") query = query.eq("source", filterSource);

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching tasks:", error.message);
          toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" });
          return;
        }

        const searchedTasks = data.filter(task =>
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (task.client_name && task.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        const sortedTasks = [...searchedTasks].sort((a, b) => {
          if (sortOrder === "newest") {
            return new Date(b.due_date || b.created_at).getTime() - new Date(a.due_date || a.created_at).getTime();
          } else if (sortOrder === "oldest") {
            return new Date(a.due_date || a.created_at).getTime() - new Date(b.due_date || b.created_at).getTime();
          } else if (sortOrder === "progress") {
            return b.progress - a.progress;
          }
          return 0;
        });

        setTasks(sortedTasks as Task[]);

        // Merge tasks into calendar events
        const formattedTasks = data.map(task => ({
          id: -task.id,
          title: task.title,
          date: task.due_date || "",
          endTime: task.due_date || "",
          type: "Task",
          color: "#800080",
          source: "Tasks",
          client: task.client_name || undefined,
          description: task.description || undefined,
          location: undefined,
        }));

        // Fetch calendar events and merge
        const { data: calendarEventData, error: calendarError } = await supabase.from("calendar_events").select("*");

        if (calendarError) {
          console.error("Error fetching calendar events:", calendarError.message);
        }

        const formattedCalendarEvents = calendarEventData?.map(event => ({
          id: event.id,
          title: event.title,
          date: event.date,
          endTime: event.end_time,
          type: event.type,
          color: event.color,
          source: event.source,
          client: event.client_name,
          description: event.description,
          location: event.location,
        })) || [];

        setMergedEvents([...formattedCalendarEvents, ...formattedTasks]);

      } catch (error) {
        console.error("An unexpected error occurred while fetching tasks:", error);
        toast({ title: "Error", description: "An unexpected error occurred while fetching tasks.", variant: "destructive" });
      }
    };

    fetchTasks();
  }, [
    userId,
    activeTab,
    searchTerm,
    filterPriority,
    filterAssignedTo,
    filterSource,
    sortOrder,
  ]);

  // Handle add task modal
  const handleAddTaskInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setNewTaskData(prev => ({ ...prev, [id]: value }));
    if (id === "client_name") {
      setClientSearchTerm(value);
    }
  };

  const handleCreateTask = async () => {
    if (!userId) return;

    const dueDateISO = newTaskData.dueDate && newTaskData.dueTime
      ? new Date(`${newTaskData.dueDate}T${newTaskData.dueTime}`).toISOString()
      : null;

    let finalClientId = newTaskData.client_id;
    if (newTaskData.client_name && !finalClientId) {
      const matchedClient = allClients.find(c => c.name.toLowerCase() === newTaskData.client_name.toLowerCase());
      if (matchedClient) {
        finalClientId = matchedClient.id;
      }
    }

    try {
      const { error } = await supabase.from("tasks").insert([{
        user_id: userId,
        title: newTaskData.title,
        description: newTaskData.description || null,
        due_date: dueDateISO,
        priority: newTaskData.priority,
        status: newTaskData.status,
        client_name: newTaskData.client_name || null,
        client_id: finalClientId,
        assigned_to_name: newTaskData.assigned_to_name,
        assigned_to_avatar: newTaskData.assigned_to_avatar,
        assigned_to_initials: newTaskData.assigned_to_initials,
        progress: newTaskData.progress,
        tags: newTaskData.tags.split(",").map(tag => tag.trim()),
        source: newTaskData.source,
      }]);

      if (error) {
        console.error("Error creating task:", error);
        toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
        return;
      }

      setOpenAddTaskModal(false);
      setNewTaskData({
        title: "",
        description: "",
        dueDate: format(new Date(), "yyyy-MM-dd"),
        dueTime: "09:00",
        priority: "Medium",
        status: "Not Started",
        client_name: "",
        client_id: null,
        assigned_to_name: "Sarah Johnson",
        assigned_to_avatar: "/placeholder.svg?height=40&width=40",
        assigned_to_initials: "SJ",
        progress: 0,
        tags: "",
        source: "Manual",
      });
      setClientSearchTerm("");

      // Re-fetch tasks
      const { data } = await supabase.from("tasks").select("*").eq("user_id", userId);
      if (data) setTasks(data as Task[]);
    } catch (error) {
      console.error("An unexpected error occurred while creating the task:", error);
      toast({ title: "Error", description: "An unexpected error occurred while creating the task.", variant: "destructive" });
    }
  };

  // Handle edit task modal open
  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    const dueDate = task.due_date ? format(parseISO(task.due_date), "yyyy-MM-dd") : "";
    const dueTime = task.due_date ? format(parseISO(task.due_date), "HH:mm") : "";

    setEditTaskData({
      id: task.id,
      title: task.title,
      description: task.description || "",
      dueDate,
      dueTime,
      priority: task.priority,
      status: task.status,
      client_name: task.client_name || "",
      client_id: task.client_id || null,
      assigned_to_name: task.assigned_to_name || "",
      assigned_to_avatar: task.assigned_to_avatar || "",
      assigned_to_initials: task.assigned_to_initials || "",
      progress: task.progress,
      tags: task.tags ? task.tags.join(", ") : "",
      source: task.source,
    });

    setClientSearchTerm(task.client_name || "");
    setOpenEditTaskModal(true);
  };

  // Handle edit task input change
  const handleEditTaskInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setEditTaskData(prev => prev ? { ...prev, [id]: value } : null);
    if (id === "client_name") {
      setClientSearchTerm(value);
      setEditTaskData(prev => prev ? { ...prev, client_id: null } : null);
    }
  };

  // Save edited task
  const handleUpdateTask = async () => {
    if (!selectedTask || !editTaskData || !userId) return;

    const dueDateISO = editTaskData.dueDate && editTaskData.dueTime
      ? new Date(`${editTaskData.dueDate}T${editTaskData.dueTime}`).toISOString()
      : null;

    let finalClientId = editTaskData.client_id;
    if (editTaskData.client_name && !finalClientId) {
      const matchedClient = allClients.find(c => c.name.toLowerCase() === editTaskData.client_name.toLowerCase());
      if (matchedClient) {
        finalClientId = matchedClient.id;
      }
    }

    try {
      const { error } = await supabase.from("tasks").update({
        title: editTaskData.title,
        description: editTaskData.description || null,
        due_date: dueDateISO,
        priority: editTaskData.priority,
        status: editTaskData.status,
        client_name: editTaskData.client_name || null,
        client_id: finalClientId,
        assigned_to_name: editTaskData.assigned_to_name,
        assigned_to_avatar: editTaskData.assigned_to_avatar,
        assigned_to_initials: editTaskData.assigned_to_initials,
        progress: editTaskData.progress,
        tags: editTaskData.tags.split(",").map(tag => tag.trim()),
        source: editTaskData.source,
      }).eq("id", selectedTask.id).eq("user_id", userId);

      if (error) {
        console.error("Error updating task:", error);
        toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
        return;
      }

      setOpenEditTaskModal(false);
      setSelectedTask(null);
      setEditTaskData(null);
      setClientSearchTerm("");

      toast({ title: "Success", description: `Task "${editTaskData.title}" updated.` });

      const { data } = await supabase.from("tasks").select("*").eq("user_id", userId);
      if (data) setTasks(data as Task[]);
    } catch (error) {
      console.error("An unexpected error occurred while updating the task:", error);
      toast({ title: "Error", description: "An unexpected error occurred while updating the task.", variant: "destructive" });
    }
  };

  // Delete task
  const handleDeleteTask = async () => {
    if (!selectedTask || !userId) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", selectedTask.id)
        .eq("user_id", userId);

      if (error) {
        console.error("Error deleting task:", error);
        toast({ title: "Error", description: "Failed to delete task.", variant: "destructive" });
        return;
      }

      setOpenDeleteConfirmModal(false);
      setSelectedTask(null);
      setClientSearchTerm("");

      toast({ title: "Success", description: `Task "${selectedTask.title}" deleted.` });

      const { data } = await supabase.from("tasks").select("*").eq("user_id", userId);
      if (data) setTasks(data as Task[]);
    } catch (error) {
      console.error("An unexpected error occurred while deleting the task:", error);
      toast({ title: "Error", description: "An unexpected error occurred while deleting the task.", variant: "destructive" });
    }
  };

  // Mark task as complete
  const markAsComplete = async (task: Task) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "Completed", progress: 100 })
        .eq("id", task.id)
        .eq("user_id", userId);

      if (error) {
        console.error("Error marking task as complete:", error);
        toast({ title: "Error", description: "Failed to mark task as complete.", variant: "destructive" });
        return;
      }

      toast({ title: "Task Completed", description: `Task "${task.title}" has been marked as complete.` });

      const { data } = await supabase.from("tasks").select("*").eq("user_id", userId);
      if (data) setTasks(data as Task[]);
    } catch (error) {
      console.error("An unexpected error occurred while marking task as complete:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    }
  };

  // Get status icon
  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "Completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "In Progress":
        return <Clock className="h-5 w-5 text-amber-500" />;
      case "Pending":
        return <AlertCircle className="h-5 w-5 text-[#2660ff]" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Tasks</h1>

      {/* Task List Section */}
      <Card>
        <CardHeader className="flex flex-row justify-between items-center pb-2">
          <div>
            <CardTitle>Task Management</CardTitle>
            <CardDescription>Manage and track your tasks</CardDescription>
          </div>
          <Button onClick={() => setOpenAddTaskModal(true)}>Add New Task</Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <div className="border-b px-4">
              <TabsList className="justify-start -mb-px">
                <TabsTrigger value="all">All Tasks</TabsTrigger>
                <TabsTrigger value="not-started">Not Started</TabsTrigger>
                <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value={activeTab} className="m-0 p-4 pt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tasks.length > 0 ? (
                  tasks.map(task => (
                    <Card key={task.id}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{task.title}</CardTitle>
                            <CardDescription className="line-clamp-2">{task.description}</CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTask(task)}>Edit Task</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markAsComplete(task)}>Mark as Complete</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setOpenDeleteConfirmModal(true);
                                }}
                              >
                                Delete Task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="mt-2 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Due:{" "}
                              {task.due_date
                                ? format(parseISO(task.due_date), "MMM d, yyyy h:mm a")
                                : "No due date"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-xs border ${
                                task.priority === "High"
                                  ? "border-red-500 text-red-500"
                                  : task.priority === "Medium"
                                  ? "border-amber-500 text-amber-500"
                                  : "border-green-500 text-green-500"
                              }`}
                            >
                              {task.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {task.status}
                            </Badge>
                          </div>
                          {task.client_name && (
                            <div className="text-xs text-muted-foreground">Client: {task.client_name}</div>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="text-xs">{task.assigned_to_name || "Unassigned"}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(task.status)}
                              <span className="text-xs">{task.status}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span>Progress</span>
                              <span>{task.progress}%</span>
                            </div>
                            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: `${task.progress}%` }}
                              ></div>
                            </div>
                          </div>
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex items-center gap-2">
                              {task.tags.map((tag, index) => (
                                <span key={index} className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <p>No tasks found</p>
                    <p className="text-sm mt-1">Try adjusting your search or filters</p>
                    <Button variant="outline" className="mt-4" onClick={() => setOpenAddTaskModal(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add Task
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Calendar View Showing Merged Events + Tasks */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Calendar View</h2>
        <CalendarView events={mergedEvents} selectedDate={currentDay} />
      </div>

      {/* Add Task Modal */}
      <Dialog open={openAddTaskModal} onOpenChange={setOpenAddTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>Enter the details for the new task.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title</Label>
              <Input id="title" placeholder="Task Title" className="col-span-3" onChange={handleAddTaskInputChange} />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea id="description" rows={3} className="col-span-3" onChange={handleAddTaskInputChange} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dueDate" className="text-right">Due Date</Label>
              <Input id="dueDate" type="date" className="col-span-3" onChange={handleAddTaskInputChange} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dueTime" className="text-right">Due Time</Label>
              <Input id="dueTime" type="time" className="col-span-3" onChange={handleAddTaskInputChange} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="priority" className="text-right">Priority</Label>
              <select
                id="priority"
                value={newTaskData.priority}
                onChange={handleAddTaskInputChange}
                className="col-span-3 border border-input bg-background px-3 py-2 text-sm rounded-md"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <select
                id="status"
                value={newTaskData.status}
                onChange={handleAddTaskInputChange}
                className="col-span-3 border border-input bg-background px-3 py-2 text-sm rounded-md"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="client_name" className="text-right">Client</Label>
              <div className="col-span-3 relative">
                <Input
                  id="client_name"
                  value={newTaskData.client_name}
                  onChange={handleAddTaskInputChange}
                  placeholder="Client Name"
                />
                {showClientSuggestions && allClients.length > 0 && (
                  <div className="absolute top-10 left-0 right-0 bg-white dark:bg-black border shadow-md rounded-md z-10 max-h-40 overflow-y-auto">
                    {allClients
                      .filter(client => client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()))
                      .map(client => (
                        <div
                          key={client.id}
                          className="p-2 hover:bg-accent cursor-pointer"
                          onClick={() => {
                            setNewTaskData(prev => ({ ...prev, client_name: client.name, client_id: client.id }));
                            setShowClientSuggestions(false);
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
              <Label htmlFor="tags" className="text-right">Tags</Label>
              <Input id="tags" placeholder="Tag1, Tag2" className="col-span-3" onChange={handleAddTaskInputChange} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="source" className="text-right">Source</Label>
              <Input id="source" value={newTaskData.source} readOnly className="col-span-3 bg-gray-100" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenAddTaskModal(false)}>Cancel</Button>
            <Button onClick={handleCreateTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog open={openEditTaskModal} onOpenChange={setOpenEditTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Edit the details of the selected task.</DialogDescription>
          </DialogHeader>
          {editTaskData && (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">Title</Label>
                  <Input id="title" value={editTaskData.title} onChange={handleEditTaskInputChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="description" className="text-right">Description</Label>
                  <Textarea id="description" value={editTaskData.description} onChange={handleEditTaskInputChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dueDate" className="text-right">Due Date</Label>
                  <Input id="dueDate" type="date" value={editTaskData.dueDate} onChange={handleEditTaskInputChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dueTime" className="text-right">Due Time</Label>
                  <Input id="dueTime" type="time" value={editTaskData.dueTime} onChange={handleEditTaskInputChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="priority" className="text-right">Priority</Label>
                  <select
                    id="priority"
                    value={editTaskData.priority}
                    onChange={handleEditTaskInputChange}
                    className="col-span-3 border border-input bg-background px-3 py-2 text-sm rounded-md"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">Status</Label>
                  <select
                    id="status"
                    value={editTaskData.status}
                    onChange={handleEditTaskInputChange}
                    className="col-span-3 border border-input bg-background px-3 py-2 text-sm rounded-md"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="client_name" className="text-right">Client</Label>
                  <div className="col-span-3 relative">
                    <Input
                      id="client_name"
                      value={editTaskData.client_name}
                      onChange={handleEditTaskInputChange}
                      placeholder="Client Name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tags" className="text-right">Tags</Label>
                  <Input id="tags" value={editTaskData.tags} onChange={handleEditTaskInputChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="source" className="text-right">Source</Label>
                  <Input id="source" value={editTaskData.source} readOnly className="col-span-3 bg-gray-100" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpenEditTaskModal(false)}>Cancel</Button>
                <Button onClick={handleUpdateTask}>Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation Modal */}
      <Dialog open={openDeleteConfirmModal} onOpenChange={setOpenDeleteConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>Are you sure you want to delete this task?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenDeleteConfirmModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTask}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
