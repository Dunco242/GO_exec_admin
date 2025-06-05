"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, PlusCircle, CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@radix-ui/react-popover";
import { Calendar } from "@/components/ui/calendar";

interface Task {
  id: number;
  user_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  project_id: number | null; // NEW
}

interface Project {
  id: number;
  name: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form states
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");
  const [newTaskDescription, setNewTaskDescription] = useState<string>("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [newTaskIsCompleted, setNewTaskIsCompleted] = useState<boolean>(false);
  const [newTaskTags, setNewTaskTags] = useState<string>("");
  const [showCreateEditModal, setShowCreateEditModal] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Project relation states
  const [isProjectRelated, setIsProjectRelated] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]); // List of available projects

  const { toast } = useToast();

  const fetchTasks = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true });

      if (error) throw error;

      setTasks(data as Task[]);
    } catch (error: any) {
      console.error("Error fetching tasks:", error.message);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", currentUserId);

      if (error) throw error;

      setAllProjects(data || []);
    } catch (error: any) {
      console.error("Error fetching projects:", error.message);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchProjects();
    }
  }, [currentUserId, fetchProjects]);

  const handleCreateTask = () => {
    resetForm();
    setShowCreateEditModal(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description || "");
    setNewTaskDueDate(task.due_date ? parseISO(task.due_date) : null);
    setNewTaskIsCompleted(task.is_completed ?? false);
    setNewTaskTags((task.tags ?? []).join(", "));
    setIsProjectRelated(!!task.project_id);
    setSelectedProjectId(task.project_id || null);
    setShowCreateEditModal(true);
  };

  const resetForm = () => {
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskDueDate(null);
    setNewTaskIsCompleted(false);
    setNewTaskTags("");
    setIsProjectRelated(false);
    setSelectedProjectId(null);
    setEditingTask(null);
  };

  const handleSaveTask = async () => {
    if (!currentUserId) {
      toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
      return;
    }

    if (!newTaskTitle.trim()) {
      toast({ title: "Validation Error", description: "Task title cannot be empty.", variant: "destructive" });
      return;
    }

    try {
      const tagsArray = newTaskTags.split(",").map(tag => tag.trim()).filter(Boolean);

      const taskData = {
        user_id: currentUserId,
        title: newTaskTitle,
        description: newTaskDescription || null,
        due_date: newTaskDueDate ? format(newTaskDueDate, "yyyy-MM-dd") : null,
        is_completed: newTaskIsCompleted,
        tags: tagsArray.length > 0 ? tagsArray : null,
        project_id: isProjectRelated ? selectedProjectId : null, // NEW: Only set if related
        updated_at: new Date().toISOString(),
      };

      let result;
      if (editingTask) {
        result = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", editingTask.id)
          .eq("user_id", currentUserId);
      } else {
        result = await supabase.from("tasks").insert({
          ...taskData,
          created_at: new Date().toISOString(),
        });
      }

      if (result.error) throw result.error;

      toast({
        title: editingTask ? "Task Updated" : "Task Created",
        description: editingTask
          ? "Your task has been updated."
          : "Your new task has been created.",
      });

      fetchTasks();
      setShowCreateEditModal(false);
    } catch (error: any) {
      console.error("Error saving task:", error.message);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!currentUserId) {
      toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
      return;
    }

    if (confirm("Are you sure you want to delete this task?")) {
      try {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId)
          .eq("user_id", currentUserId);

        if (error) throw error;

        toast({ title: "Task Deleted", description: "The task has been successfully deleted." });
        fetchTasks();
      } catch (error: any) {
        console.error("Error deleting task:", error.message);
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Tasks</h1>
        <Button onClick={handleCreateTask}>
          <PlusCircle className="mr-2 h-5 w-5" /> New Task
        </Button>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateEditModal} onOpenChange={setShowCreateEditModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Create New Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Modify your task details below." : "Enter details for your new task."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title</Label>
              <Input
                id="title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Task title"
                className="col-span-3"
              />
            </div>

            {/* Description */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right pt-2">Description</Label>
              <Textarea
                id="description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                rows={4}
                placeholder="Optional description..."
                className="col-span-3"
              />
            </div>

            {/* Due Date */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dueDate" className="text-right">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newTaskDueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newTaskDueDate ? format(newTaskDueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    required={true}
                    selected={newTaskDueDate || undefined}
                    onSelect={(date: Date | null) => setNewTaskDueDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Completion Status */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="completed" className="text-right">Status</Label>
              <Checkbox
                id="completed"
                checked={newTaskIsCompleted}
                onCheckedChange={(checked) => setNewTaskIsCompleted(!!checked)}
                className="col-span-3"
              />
              <Label htmlFor="completed" className="col-span-3 ml-8 mt-1 text-sm">
                Mark as completed
              </Label>
            </div>

            {/* Tags */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tags" className="text-right">Tags</Label>
              <Input
                id="tags"
                value={newTaskTags}
                onChange={(e) => setNewTaskTags(e.target.value)}
                placeholder="e.g., urgent, client"
                className="col-span-3"
              />
            </div>

            {/* Project Related Section */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Note Type</Label>
              <RadioGroup
                value={isProjectRelated ? "project_related" : "general"}
                onValueChange={(value) =>
                  setIsProjectRelated(value === "project_related")
                }
                className="flex items-center space-x-4 col-span-3"
              >
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="general" id="type-general" />
                  <Label htmlFor="type-general">General</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="project_related" id="type-project" />
                  <Label htmlFor="type-project">Project Related</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Project Autocomplete Dropdown */}
            {isProjectRelated && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="relatedProject" className="text-right">Select Project</Label>
                <Select
                  value={selectedProjectId?.toString() || ""}
                  onValueChange={(value) => setSelectedProjectId(parseInt(value))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Link to a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProjects.length === 0 ? (
                      <SelectItem disabled value="no-projects">No projects available</SelectItem>
                    ) : (
                      allProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
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
            <Button onClick={handleSaveTask}>Save Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tasks List */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <p>Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <p className="text-sm text-gray-500 italic">No tasks found. Click "New Task" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <Card key={task.id} className="shadow-lg rounded-lg overflow-hidden flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{task.title}</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  {task.due_date ? `Due: ${format(parseISO(task.due_date), "MMM d, yyyy")}` : "No due date"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm line-clamp-3 text-gray-700">{task.description || "No description provided."}</p>
                {task.tags && task.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {task.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditTask(task)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteTask(task.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
