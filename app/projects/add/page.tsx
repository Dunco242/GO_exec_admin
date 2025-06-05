"use client";
import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: number;
  name: string;
}

import { supabase } from "@/lib/supabaseClient";


export default function AddProjectPage() {
  const { toast } = useToast();

  const [newProjectData, setNewProjectData] = useState({
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
    client_id: null as number | null,
    client_name: "",
    calendar_event_id: null as number | null,
    primary_document_id: null as number | null,
    primary_email_id: null as number | null,
    primary_note_id: null as number | null,
    assigned_to_user_id: null as string | null, // Added assigned_to_user_id
  });

  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);

  useEffect(() => {
    const fetchUserAndSettings = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to create a project.",
          variant: "destructive",
        });
        window.location.href = "/login";
        return;
      }
      setUserId(user.id);

      const { data: userSettings, error: settingsError } = await supabase
        .from("user_settings")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      if (settingsError) {
        setNewProjectData((prev) => ({
          ...prev,
          user_id: user.id,
          assigned_to_name: "",
          assigned_to_user_id: user.id, // Set assigned_to_user_id here
        }));
      } else {
        setNewProjectData((prev) => ({
          ...prev,
          user_id: user.id,
          assigned_to_name: userSettings?.user_name || "",
          assigned_to_user_id: user.id, // Set assigned_to_user_id here
        }));
      }
    };

    fetchUserAndSettings();
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (clientSearchTerm.trim()) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name")
          .ilike("name", `%${clientSearchTerm}%`);

        if (error) {
          setAllClients([]);
          return;
        }

        setAllClients(data || []);
      } else {
        setAllClients([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [clientSearchTerm]);

  const handleChange = (
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

  const generateProjectDescription = async () => {
    if (!newProjectData.name.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a Project Name before generating a description.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingDescription(true);

    try {
      const prompt = `Generate a concise project description for a project named: "${newProjectData.name}". Focus on the main goal and expected outcome. Keep it to 2-3 sentences.`;
      const apiKey = ""; // Assume API key provided by Canvas
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      });

      const result = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const generatedText = result.candidates[0].content.parts[0].text;
        setNewProjectData((prev) => ({ ...prev, description: generatedText }));
        toast({
          title: "Description Generated",
          description: "A project description has been generated.",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: "Could not generate a description. Please try again.",
          variant: "destructive",
        });
        console.error("Gemini API response structure unexpected:", result);
      }
    } catch (error: unknown) {
      let errorMessage = "An unknown error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      toast({
        title: "API Error",
        description: `Failed to connect to Gemini API: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingDescription(false);
    }
  };

  const handleCreateNewProject = async () => {
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
      assigned_to_user_id, // Destructure assigned_to_user_id
    } = newProjectData;

    if (!userId) {
      toast({
        title: "Authentication Error",
        description: "Please log in again.",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Validation Failed",
        description: "Please provide a project name.",
        variant: "destructive",
      });
      return;
    }

    try {
      const insertData = {
        name,
        description: description || null,
        status,
        priority,
        start_date: start_date || null,
        end_date: end_date || null,
        progress,
        budget,
        estimated_cost,
        actual_cost,
        assigned_to: assigned_to || null,
        assigned_to_name: assigned_to_name || null,
        client_id: client_id || null,
        client_name: client_name || null,
        user_id: userId,
        assigned_to_user_id: assigned_to_user_id, // Include assigned_to_user_id here
        calendar_event_id: null,
        primary_document_id: null,
        primary_email_id: null,
        primary_note_id: null,
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

      toast({ title: "Success", description: `"${name}" has been added.` });
      window.location.href = "/projects";
    } catch (error: unknown) {
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      toast({
        title: "Error",
        description: `Failed to create project: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Add New Project</h1>
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Fill in the details below to create a new project.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 py-4">
            {/* Name Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="md:text-right">Name</Label>
              <Input
                id="name"
                value={newProjectData.name}
                onChange={handleChange}
                placeholder="Enter project name"
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Description Textarea */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="md:text-right pt-2">Description</Label>
              <div className="col-span-1 md:col-span-3 flex flex-col gap-2">
                <Textarea
                  id="description"
                  value={newProjectData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe this project..."
                  className="w-full"
                />
                <Button
                  onClick={generateProjectDescription}
                  disabled={isLoadingDescription || !newProjectData.name.trim()}
                  className="w-fit self-end"
                >
                  {isLoadingDescription ? "Generating..." : "✨ Generate Description"}
                </Button>
              </div>
            </div>

            {/* Assigned To Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="assigned_to" className="md:text-right">Assigned To (Free Text)</Label>
              <Input
                id="assigned_to"
                value={newProjectData.assigned_to}
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
                value={newProjectData.assigned_to_name}
                readOnly
                className="col-span-1 md:col-span-3 bg-gray-100 cursor-not-allowed"
              />
            </div>

            {/* Status Select */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="md:text-right">Status</Label>
              <Select
                value={newProjectData.status}
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

            {/* Priority Select */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="priority" className="md:text-right">Priority</Label>
              <Select
                value={newProjectData.priority}
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

            {/* Start Date Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="start_date" className="md:text-right">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={newProjectData.start_date}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* End Date Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="end_date" className="md:text-right">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={newProjectData.end_date}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Progress Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="progress" className="md:text-right">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={String(newProjectData.progress)}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Budget Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="budget" className="md:text-right">Budget</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                min="0"
                value={String(newProjectData.budget)}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Estimated Cost Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="estimated_cost" className="md:text-right">Estimated Cost</Label>
              <Input
                id="estimated_cost"
                type="number"
                step="0.01"
                min="0"
                value={String(newProjectData.estimated_cost)}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Actual Cost Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="actual_cost" className="md:text-right">Actual Cost</Label>
              <Input
                id="actual_cost"
                type="number"
                step="0.01"
                min="0"
                value={String(newProjectData.actual_cost)}
                onChange={handleChange}
                className="col-span-1 md:col-span-3"
              />
            </div>

            {/* Client Search Input */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
              <Label htmlFor="client_name" className="md:text-right">Client</Label>
              <div className="relative col-span-1 md:col-span-3">
                <Input
                  id="client_name"
                  value={clientSearchTerm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClientSearchTerm(value);
                    setNewProjectData((prev) => ({ ...prev, client_name: value }));
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
          <Button variant="secondary" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button onClick={handleCreateNewProject}>Create Project</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
