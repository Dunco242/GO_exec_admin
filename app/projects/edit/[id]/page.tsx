"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export default function EditProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  // Project state with proper initialization
  const [project, setProject] = useState<any>({
    id: null,
    name: "",
    description: "",
    status: "Pending",
    priority: "Medium",
    start_date: "",
    end_date: "",
    progress: 0,
    budget: 0,
    estimated_cost: 0,
    actual_cost: 0,
    assigned_to: "",
    assigned_to_name: "",
    user_id: "",
    client_id: null,
    client_name: "",
    calendar_event_id: null,
    primary_document_id: null,
    primary_email_id: null,
    primary_note_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Client search state
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [allClients, setAllClients] = useState<{ id: number; name: string }[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Fetch project data on component mount
  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) {
        console.error("Error fetching project:", error.message);
        toast({
          title: "Error",
          description: `Failed to load project: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Safely set project data with null coalescing
      setProject((prev: any) => ({
        ...prev,
        ...data,
        actual_cost: data.actual_cost ?? 0,
        budget: data.budget ?? 0,
        estimated_cost: data.estimated_cost ?? 0,
        progress: data.progress ?? 0,
      }));

      setClientSearchTerm(data.client_name || "");
    };

    fetchProject();
  }, [projectId, toast]);

  // Handle input changes with proper type validation
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;

    // Handle progress with constraints
    if (id === "progress") {
      const numericValue = Math.min(100, Math.max(0, parseInt(value, 10)));
      setProject((prev: any) => ({
        ...prev,
        progress: isNaN(numericValue) ? 0 : numericValue,
      }));
    }
    // Handle financial fields
    else if (["budget", "estimated_cost", "actual_cost"].includes(id)) {
      const numericValue = parseFloat(value);
      setProject((prev: any) => ({
        ...prev,
        [id]: isNaN(numericValue) ? 0 : numericValue,
      }));
    }
    // Handle client name search
    else if (id === "client_name") {
      setProject((prev: any) => ({ ...prev, client_name: value }));
      setClientSearchTerm(value);
      setShowClientSuggestions(true);
    }
    // Handle all other fields
    else {
      setProject((prev: any) => ({ ...prev, [id]: value }));
    }
  };

  // Handle select dropdown changes
  const handleSelectChange = (id: string, value: string) => {
    setProject((prev: any) => ({ ...prev, [id]: value }));
  };

  // Handle client assignment from suggestions
  const handleAssignClient = (client: { id: number; name: string }) => {
    setProject((prev: any) => ({
      ...prev,
      client_id: client.id,
      client_name: client.name,
    }));
    setClientSearchTerm(client.name);
    setShowClientSuggestions(false);
  };

  // Save project changes
  const handleSaveChanges = async () => {
    const { name } = project;

    // Validation
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData = {
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        start_date: project.start_date,
        end_date: project.end_date,
        progress: project.progress,
        budget: project.budget,
        estimated_cost: project.estimated_cost,
        actual_cost: project.actual_cost,
        assigned_to: project.assigned_to,
        assigned_to_name: project.assigned_to_name,
        client_id: project.client_id,
        client_name: project.client_name,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `"${name}" has been updated successfully.`,
      });

      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to update project: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  // Client search with debouncing
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (clientSearchTerm.trim()) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name")
          .ilike("name", `%${clientSearchTerm}%`)
          .limit(10);

        if (error) {
          console.error("Error searching clients:", error);
          setAllClients([]);
        } else {
          setAllClients(data || []);
        }
      } else {
        setAllClients([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [clientSearchTerm]);

  // Loading state
  if (!project || !project.id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Project</h1>
        <p className="text-muted-foreground mt-2">
          Update project details and track progress
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Project Information</CardTitle>
          <CardDescription>
            Modify the project details below and save your changes
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center">
              <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
              Basic Information
            </h3>

            {/* Project Name */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="md:text-right font-medium">
                Project Name *
              </Label>
              <Input
                id="name"
                value={project.name}
                onChange={handleChange}
                placeholder="Enter project name"
                className="col-span-1 md:col-span-3 focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            {/* Description */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="md:text-right font-medium pt-2">
                Description
              </Label>
              <Textarea
                id="description"
                value={project.description}
                onChange={handleChange}
                rows={4}
                placeholder="Describe the project objectives and scope..."
                className="col-span-1 md:col-span-3 resize-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Client Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="client_name" className="md:text-right font-medium">
                Client
              </Label>
              <div className="relative col-span-1 md:col-span-3">
                <Input
                  id="client_name"
                  value={clientSearchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClientSearchTerm(value);
                    setProject((prev: any) => ({ ...prev, client_name: value }));
                    setShowClientSuggestions(true);
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                  placeholder="Search or enter client name"
                  className="w-full focus:ring-2 focus:ring-primary/20"
                />
                {showClientSuggestions && allClients.length > 0 && (
                  <ul className="absolute z-20 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {allClients.map((client) => (
                      <li
                        key={client.id}
                        onMouseDown={() => handleAssignClient(client)}
                        className="p-3 hover:bg-accent cursor-pointer transition-colors border-b last:border-b-0"
                      >
                        <span className="font-medium">{client.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Assignment Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Assignment Details
            </h3>

            {/* Assigned To */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="assigned_to" className="md:text-right font-medium">
                Assigned To
              </Label>
              <Input
                id="assigned_to"
                value={project.assigned_to}
                onChange={handleChange}
                placeholder="Team member or contractor name"
                className="col-span-1 md:col-span-3 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Assigned By (Read-only) */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="assigned_to_name_display" className="md:text-right font-medium">
                Assigned By
              </Label>
              <Input
                id="assigned_to_name_display"
                value={project.assigned_to_name || "You"}
                readOnly
                className="col-span-1 md:col-span-3 bg-muted/50 cursor-not-allowed"
              />
            </div>
          </div>

          <Separator />

          {/* Project Status Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Status & Priority
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status" className="font-medium">Status</Label>
                <Select
                  value={project.status}
                  onValueChange={(value) => handleSelectChange("status", value)}
                >
                  <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
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

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority" className="font-medium">Priority</Label>
                <Select
                  value={project.priority}
                  onValueChange={(value) => handleSelectChange("priority", value)}
                >
                  <SelectTrigger className="focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Timeline Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
              Timeline & Progress
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start_date" className="font-medium">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={project.start_date || ""}
                  onChange={handleChange}
                  className="focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="end_date" className="font-medium">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={project.end_date || ""}
                  onChange={handleChange}
                  className="focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Progress */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="progress" className="md:text-right font-medium">
                Progress (%)
              </Label>
              <div className="col-span-1 md:col-span-3">
                <Input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={String(project.progress)}
                  onChange={handleChange}
                  className="focus:ring-2 focus:ring-primary/20"
                />
                <div className="mt-2 w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Financial Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              Financial Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Budget */}
              <div className="space-y-2">
                <Label htmlFor="budget" className="font-medium">Budget</Label>
                <Input
                  id="budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={String(project.budget)}
                  onChange={handleChange}
                  className="focus:ring-2 focus:ring-primary/20"
                  placeholder="0.00"
                />
              </div>

              {/* Estimated Cost */}
              <div className="space-y-2">
                <Label htmlFor="estimated_cost" className="font-medium">Estimated Cost</Label>
                <Input
                  id="estimated_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={String(project.estimated_cost)}
                  onChange={handleChange}
                  className="focus:ring-2 focus:ring-primary/20"
                  placeholder="0.00"
                />
              </div>

              {/* Actual Cost */}
              <div className="space-y-2">
                <Label htmlFor="actual_cost" className="font-medium">Actual Cost</Label>
                <Input
                  id="actual_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={String(project.actual_cost ?? 0)}
                  onChange={handleChange}
                  className="focus:ring-2 focus:ring-primary/20"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-muted/30 rounded-lg p-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">Budget</p>
                  <p className="font-semibold text-lg">${project.budget?.toLocaleString() || '0'}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Estimated</p>
                  <p className="font-semibold text-lg">${project.estimated_cost?.toLocaleString() || '0'}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Actual</p>
                  <p className="font-semibold text-lg">${project.actual_cost?.toLocaleString() || '0'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between pt-6 bg-muted/20">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveChanges}
            className="min-w-[140px] bg-primary hover:bg-primary/90"
          >
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
