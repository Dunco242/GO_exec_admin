"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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

export default function EditProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

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

  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [allClients, setAllClients] = useState<{ id: number; name: string }[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Fetch project data on mount
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
  }, [projectId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;

    if (id === "progress") {
      const numericValue = Math.min(100, Math.max(0, parseInt(value, 10)));
      setProject((prev: any) => ({
        ...prev,
        progress: isNaN(numericValue) ? 0 : numericValue,
      }));
    } else if (["budget", "estimated_cost", "actual_cost"].includes(id)) {
      const numericValue = parseFloat(value);
      setProject((prev: any) => ({
        ...prev,
        [id]: isNaN(numericValue) ? 0 : numericValue,
      }));
    } else if (id === "client_name") {
      setProject((prev: any) => ({ ...prev, client_name: value }));
      setClientSearchTerm(value);
      setShowClientSuggestions(true);
    } else if (id === "assigned_to") {
      setProject((prev: any) => ({ ...prev, assigned_to: value }));
    } else if (id === "name" || id === "description") {
      setProject((prev: any) => ({ ...prev, [id]: value }));
    } else {
      setProject((prev: any) => ({ ...prev, [id]: value }));
    }
  };

  const handleSelectChange = (id: string, value: string) => {
    setProject((prev: any) => ({ ...prev, [id]: value }));
  };

  const handleAssignClient = (client: { id: number; name: string }) => {
    setProject((prev: any) => ({
      ...prev,
      client_id: client.id,
      client_name: client.name,
    }));
    setClientSearchTerm(client.name);
    setShowClientSuggestions(false);
  };

  const handleSaveChanges = async () => {
    const {
      name,
      description,
      status,
      priority,
      start_date,
      end_date,
      progress,
      budget,
      estimated_cost,
      actual_cost,
      assigned_to,
      assigned_to_name,
      client_id,
      client_name,
    } = project;

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
        name,
        description,
        status,
        priority,
        start_date,
        end_date,
        progress,
        budget,
        estimated_cost,
        actual_cost,
        assigned_to,
        assigned_to_name,
        client_id,
        client_name,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", projectId);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `"${name}" has been updated.`,
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

  // Search clients for autocomplete
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (clientSearchTerm.trim()) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name")
          .ilike("name", `%${clientSearchTerm}%`);

        if (error) {
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

  if (!project) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Edit Project - TEST</h1>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Update the details below.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="md:text-right">Name</Label>
              <Input
                id="name"
                value={project.name}
                onChange={handleChange}
                placeholder="Enter project name"
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Description */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="md:text-right pt-2">Description</Label>
              <Textarea
                id="description"
                value={project.description}
                onChange={handleChange}
                rows={4}
                placeholder="Describe this project..."
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Assigned To */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="assigned_to" className="md:text-right">Assigned To (Free Text)</Label>
              <Input
                id="assigned_to"
                value={project.assigned_to}
                onChange={handleChange}
                placeholder="Assign to someone (e.g., another team member)"
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Assigned By (You) */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="assigned_to_name_display" className="md:text-right">Assigned By (You)</Label>
              <Input
                id="assigned_to_name_display"
                value={project.assigned_to_name}
                readOnly
                className="col-span-1 md:col-span-3 bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Status */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="md:text-right">Status</Label>
              <Select
                value={project.status}
                onValueChange={(value) => handleSelectChange("status", value)}
              >
                <SelectTrigger className="col-span-1 md:col-span-3">
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
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="priority" className="md:text-right">Priority</Label>
              <Select
                value={project.priority}
                onValueChange={(value) => handleSelectChange("priority", value)}
              >
                <SelectTrigger className="col-span-1 md:col-span-3">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="start_date" className="md:text-right">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={project.start_date || ""}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* End Date */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="end_date" className="md:text-right">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={project.end_date || ""}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Progress */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="progress" className="md:text-right">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={String(project.progress)}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Budget */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="budget" className="md:text-right">Budget</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                min="0"
                value={String(project.budget)}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Estimated Cost */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="estimated_cost" className="md:text-right">Estimated Cost</Label>
              <Input
                id="estimated_cost"
                type="number"
                step="0.01"
                min="0"
                value={String(project.estimated_cost)}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Actual Cost */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="actual_cost" className="md:text-right">Actual Cost</Label>
              <Input
                id="actual_cost"
                type="number"
                step="0.01"
                min="0"
                value={String(project.actual_cost ?? 0)}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Client Name */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="client_name" className="md:text-right">Client</Label>
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
                  className="w-full"
                />
                {showClientSuggestions && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border rounded shadow-md max-h-40 overflow-y-auto">
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
        </CardContent>

        <CardFooter className="flex justify-end space-x-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Back
          </Button>
                    <Button onClick={handleSaveChanges}>Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
