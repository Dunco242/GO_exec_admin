"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  priority: string | null;
  progress: number;
  budget: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  client_name: string | null;
}

interface Note {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

interface Task {
  id: number;
  title: string;
  status: string;
  due_date: string;
  progress: number;
}

interface CalendarEvent {
  id: number;
  title: string;
  date: string;
}

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = parseInt(params.id as string);
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchData = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated");
      }
      setCurrentUserId(user.id);

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) {
        throw new Error(`Failed to fetch project: ${projectError.message}`);
      }

      setProject(projectData);

      // Fetch notes linked to project
      const { data: notesData, error: notesError } = await supabase
        .from("notes")
        .select("id, title, content, updated_at")
        .eq("project_id", projectId)
        .eq("user_id", user.id); // Ensure user owns the note

      if (notesError && notesError.code !== "PGRST116") {
        throw new Error(`Failed to fetch notes: ${notesError.message}`);
      }
      setNotes(notesData || []);

      // Fetch tasks linked to project
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, progress")
        .eq("project_id", projectId)
        .eq("user_id", user.id); // Ensure user owns the task

      if (tasksError && tasksError.code !== "PGRST116") {
        throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
      }
      setTasks(tasksData || []);

      // Fetch calendar events linked to project
      const { data: eventData, error: eventsError } = await supabase
        .from("calendar_events")
        .select("id, title, date")
        .eq("project_id", projectId)
        .eq("user_id", user.id); // Ensure user owns the event

      if (eventsError && eventsError.code !== "PGRST116") {
        throw new Error(`Failed to fetch calendar events: ${eventsError.message}`);
      }
      setEvents(eventData || []);

      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching project details:", error.message);
      toast({
        title: "Error",
        description: `Failed to load project details: ${error.message}`,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading project details...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4">
        <h2 className="text-xl font-semibold">Project Not Found</h2>
        <p className="text-gray-500 mt-2">The requested project does not exist or you do not have access.</p>
        <Button onClick={() => router.push("/projects")} className="mt-4">
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Project Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl">{project.name}</CardTitle>
              <CardDescription>{project.client_name ? `Client: ${project.client_name}` : "No client assigned"}</CardDescription>
            </div>
            <Badge variant="outline">{project.status || "N/A"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Description</p>
              <p className="mt-1">{project.description || "No description provided."}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Timeline</p>
              <p className="mt-1">
                {project.start_date ? format(parseISO(project.start_date), "PPP") : "Not set"}{" "}
                →{" "}
                {project.end_date ? format(parseISO(project.end_date), "PPP") : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Budget</p>
              <p className="mt-1">${project.budget?.toFixed(2) || "0.00"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Progress</p>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${Math.min(project.progress || 0, 100)}%` }}
                ></div>
              </div>
              <p className="mt-1 text-right">{project.progress || 0}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Notes directly linked to this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length > 0 ? (
            <ul className="space-y-4">
              {notes.map((note) => (
                <li key={note.id} className="border-b pb-2">
                  <h3 className="font-medium">{note.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{note.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No notes found for this project.</p>
          )}
        </CardContent>
      </Card>

      {/* Tasks Section */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Tasks associated with this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <ul className="space-y-4">
              {tasks.map((task) => (
                <li key={task.id} className="border-b pb-2">
                  <h3 className="font-medium">{task.title}</h3>
                  <div className="flex justify-between mt-1">
                    <Badge variant="secondary">{task.status}</Badge>
                    <span className="text-sm text-gray-500">
                      Due: {format(parseISO(task.due_date), "MMM d")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No tasks found for this project.</p>
          )}
        </CardContent>
      </Card>

      {/* Calendar Events Section */}
      <Card>
        <CardHeader>
          <CardTitle>Calendar Events</CardTitle>
          <CardDescription>Related calendar entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <ul className="space-y-4">
              {events.map((event) => (
                <li key={event.id}>
                  <h3 className="font-medium">{event.title}</h3>
                  <p className="text-sm text-gray-500">
                    Date: {format(parseISO(event.date), "PPP")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No calendar events linked to this project.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
