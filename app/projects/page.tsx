"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { supabase }
from "@/lib/supabaseClient";
import { ProgressBar } from "@/components/ui/progress";
import { format } from "date-fns"; // Import format from date-fns
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
// Removed import for ScrollArea

interface Project {
  id: number;
  name: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  progress?: number | null;
  budget?: number | null;
  estimated_cost?: number | null; // Added
  actual_cost?: number | null; // Added
  start_date?: string | null;
  end_date?: string | null;
  user_id?: string | null;
  client_id?: number | null;
  client_name?: string | null; // Added
  assigned_to?: string | null; // Added
  assigned_to_name?: string | null; // Added
  assigned_to_user_id?: string | null; // Added
  calendar_event_id?: number | null; // Added
  primary_document_id?: number | null; // Added
  primary_email_id?: number | null; // Added
  primary_note_id?: number | null; // Added
}

interface Client {
  id: number;
  name: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOption, setSortOption] = useState("name");
  const [openAddProjectModal, setOpenAddProjectModal] = useState(false);
  const [newProjectData, setNewProjectData] = useState<Omit<Project, "id">>({
    name: "",
    description: "",
    status: "Pending",
    priority: "Medium",
    progress: 0,
    budget: 0,
    estimated_cost: 0, // Initialized
    actual_cost: 0, // Initialized
    start_date: "",
    end_date: "",
    user_id: null,
    client_id: null,
    client_name: "", // Initialized
    assigned_to: "", // Initialized
    assigned_to_name: "", // Initialized
    assigned_to_user_id: null, // Initialized
    calendar_event_id: null,
    primary_document_id: null,
    primary_email_id: null,
    primary_note_id: null,
  });

  const [allClients, setAllClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndSettings = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("User not authenticated:", userError?.message);
        toast({
          title: "Authentication Required",
          description: "Please log in to create a project.",
          variant: "destructive",
        });
        // Optionally redirect to login page
        // router.push("/login");
        return;
      }
      setUserId(user.id);

      // Fetch user's name from user_settings for assigned_to_name
      const { data: userSettings, error: settingsError } = await supabase
        .from("user_settings")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      setNewProjectData((prev) => ({
        ...prev,
        user_id: user.id,
        assigned_to_user_id: user.id, // Set assigned_to_user_id to current user
        assigned_to_name: userSettings?.user_name || "",
      }));
    };

    fetchUserAndSettings();
  }, [toast]);


  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) throw error;
      setProjects(data || []);
    } catch (err: any) {
      console.error("Error fetching projects:", err.message);
      toast({
        title: "Error",
        description: `Failed to load projects: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (clientSearchTerm.trim() && userId) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name")
          .ilike("name", `%${clientSearchTerm}%`)
          .eq("user_id", userId); // Filter by user_id for clients

        if (error) {
          console.error("Error fetching clients:", error.message);
          setAllClients([]);
          return;
        }
        setAllClients(data || []);
      } else {
        setAllClients([]);
      }
    }, 300); // Debounce client search

    return () => clearTimeout(timer);
  }, [clientSearchTerm, userId]);


  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || project.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortOption) {
      case "name":
        return (a.name || "").localeCompare(b.name || "");
      case "start_date":
        return (
          new Date(a.start_date || "").getTime() - new Date(b.start_date || "").getTime()
        );
      case "progress":
        return (a.progress ?? 0) - (b.progress ?? 0);
      default:
        return 0;
    }
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;

    if (id === "progress") {
      const numericValue = Math.min(100, Math.max(0, parseInt(value, 10)));
      setNewProjectData((prev) => ({ ...prev, progress: isNaN(numericValue) ? 0 : numericValue }));
    } else if (["budget", "estimated_cost", "actual_cost"].includes(id)) {
      const numericValue = parseFloat(value);
      setNewProjectData((prev) => ({
        ...prev,
        [id]: isNaN(numericValue) ? 0 : numericValue,
      }));
    } else if (id === "client_name") {
      setNewProjectData((prev) => ({ ...prev, client_name: value }));
      setClientSearchTerm(value);
      setShowClientSuggestions(true);
    } else if (id === "assigned_to") {
      setNewProjectData((prev) => ({ ...prev, assigned_to: value }));
    } else {
      setNewProjectData((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleSelectChange = (id: string, value: string) => {
    setNewProjectData((prev) => ({ ...prev, [id]: value }));
  };

  const handleAssignClient = (client: Client) => {
    setNewProjectData((prev) => ({
      ...prev,
      client_id: client.id,
      client_name: client.name,
    }));
    setClientSearchTerm(client.name);
    setShowClientSuggestions(false);
  };


  const handleCreateNewProject = async () => {
    if (!newProjectData.name.trim()) {
      toast({
        title: "Validation Failed",
        description: "Please provide a project name.",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Authentication Error",
        description: "User not authenticated. Please log in.",
        variant: "destructive",
      });
      return;
    }

    try {
      const insertData = {
        name: newProjectData.name,
        description: newProjectData.description || null,
        status: newProjectData.status,
        priority: newProjectData.priority,
        start_date: newProjectData.start_date || null,
        end_date: newProjectData.end_date || null,
        progress: newProjectData.progress,
        budget: newProjectData.budget,
        estimated_cost: newProjectData.estimated_cost,
        actual_cost: newProjectData.actual_cost,
        assigned_to: newProjectData.assigned_to || null,
        assigned_to_name: newProjectData.assigned_to_name || null,
        assigned_to_user_id: newProjectData.assigned_to_user_id,
        client_id: newProjectData.client_id || null,
        client_name: newProjectData.client_name || null,
        user_id: userId, // Ensure user_id is set to the current authenticated user
        calendar_event_id: newProjectData.calendar_event_id,
        primary_document_id: newProjectData.primary_document_id,
        primary_email_id: newProjectData.primary_email_id,
        primary_note_id: newProjectData.primary_note_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("projects").insert([insertData]);

      if (error) {
        console.error("Error creating project:", error.message);
        toast({
          title: "Error",
          description: `Failed to create project: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Project "${newProjectData.name}" created.`,
      });

      setOpenAddProjectModal(false);
      // Reset form data after successful creation
      setNewProjectData({
        name: "",
        description: "",
        status: "Pending",
        priority: "Medium",
        progress: 0,
        budget: 0,
        estimated_cost: 0,
        actual_cost: 0,
        start_date: "",
        end_date: "",
        user_id: userId, // Keep current user ID
        client_id: null,
        client_name: "",
        assigned_to: "",
        assigned_to_name: newProjectData.assigned_to_name, // Keep current user's name
        assigned_to_user_id: userId, // Keep current user ID
        calendar_event_id: null,
        primary_document_id: null,
        primary_email_id: null,
        primary_note_id: null,
      });
      setClientSearchTerm(""); // Reset client search term

      fetchProjects(); // Re-fetch projects to update the list
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to create project: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Projects</h1>
        <Button size="lg" onClick={() => setOpenAddProjectModal(true)}>
          + Add Project
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="relative col-span-2">
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <div className="absolute left-3 top-2.5 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full rounded-md border p-2 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>

            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="block w-full rounded-md border p-2 text-sm"
            >
              <option value="name">Sort by Name</option>
              <option value="start_date">Sort by Start Date</option>
              <option value="progress">Sort by Progress</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedProjects.map((project) => (
          <Card
            key={project.id}
            className="hover:shadow-xl shadow-md transition-shadow cursor-pointer border border-muted"
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg truncate">{project.name}</CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                {project.description || "No description provided."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={
                    project.status === "Completed"
                      ? "default"
                      : project.status === "Active"
                        ? "secondary"
                        : project.status === "Pending"
                          ? "outline"
                          : "destructive"
                  }
                >
                  {project.status || "Not Set"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span>{project.priority || "Medium"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start</span>
                <span>
                  {project.start_date
                    ? format(new Date(project.start_date), "MMM dd,yyyy")
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">End</span>
                <span>
                  {project.end_date
                    ? format(new Date(project.end_date), "MMM dd,yyyy")
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Budget</span>
                <span>${(project.budget ?? 0).toLocaleString()}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress</span>
                  <span>{project.progress ?? 0}%</span>
                </div>
                <ProgressBar value={project.progress ?? 0} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={openAddProjectModal} onOpenChange={setOpenAddProjectModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0"> {/* Removed overflow-hidden, min-h-0, and set p-0 */}
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Fill out the fields to create a new project.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-6 overflow-y-auto"> {/* Added overflow-y-auto here */}
            <div className="grid gap-4">
              {/* Name Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input
                  id="name"
                  value={newProjectData.name}
                  onChange={handleInputChange}
                  placeholder="Enter project name"
                  className="col-span-3"
                />
              </div>

              {/* Description Textarea */}
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="description" className="text-right pt-2">Description</Label>
                <Textarea
                  id="description"
                  value={newProjectData.description ?? ""}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Describe this project..."
                  className="col-span-3"
                />
              </div>

              {/* Assigned To Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assigned_to" className="text-right">Assigned To (Free Text)</Label>
                <Input
                  id="assigned_to"
                  value={newProjectData.assigned_to ?? ""}
                  onChange={handleInputChange}
                  placeholder="Assign to someone (e.g., another team member)"
                  className="col-span-3"
                />
              </div>

              {/* Assigned By (You) */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assigned_to_name_display" className="text-right">Assigned By (You)</Label>
                <Input
                  id="assigned_to_name_display"
                  value={newProjectData.assigned_to_name ?? ""}
                  readOnly
                  className="col-span-3 bg-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Status Select */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select
                  value={newProjectData.status ?? "Pending"}
                  onValueChange={(value) => handleSelectChange("status", value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority Select */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="priority" className="text-right">Priority</Label>
                <Select
                  value={newProjectData.priority ?? "Medium"}
                  onValueChange={(value) => handleSelectChange("priority", value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="start_date" className="text-right">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={newProjectData.start_date ?? ""}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>

              {/* End Date Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="end_date" className="text-right">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={newProjectData.end_date ?? ""}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>

              {/* Progress Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="progress" className="text-right">Progress (%)</Label>
                <Input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={String(newProjectData.progress ?? 0)}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>

              {/* Budget Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="budget" className="text-right">Budget</Label>
                <Input
                  id="budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={String(newProjectData.budget ?? 0)}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>

              {/* Estimated Cost Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="estimated_cost" className="text-right">Estimated Cost</Label>
                <Input
                  id="estimated_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={String(newProjectData.estimated_cost ?? 0)}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>

              {/* Actual Cost Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="actual_cost" className="text-right">Actual Cost</Label>
                <Input
                  id="actual_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={String(newProjectData.actual_cost ?? 0)}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>

              {/* Client Search Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="client_name" className="text-right">Client</Label>
                <div className="relative col-span-3">
                  <Input
                    id="client_name"
                    value={clientSearchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setShowClientSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                    placeholder="Search or enter client name"
                    className="w-full"
                  />
                  {showClientSuggestions && (
                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded shadow-md max-h-40 overflow-y-auto">
                      {allClients.length === 0 ? (
                        <li className="p-2 text-muted-foreground">No matching clients</li>
                      ) : (
                        allClients.map((client) => (
                          <li
                            key={client.id}
                            onMouseDown={() => handleAssignClient(client)}
                            className="p-2 hover:bg-accent cursor-pointer"
                          >
                            {client.name}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-4">
            <Button type="button" onClick={handleCreateNewProject}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
