"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
}

export default function TaskDetailPage() {
  const params = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTask = async () => {
      const id = parseInt(params.id as string, 10);
      if (isNaN(id)) return;

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching task:", error.message);
        return;
      }

      setTask(data);
      setLoading(false);
    };

    fetchTask();
  }, [params.id]);

  if (loading) return <div>Loading...</div>;
  if (!task) return <div>Task not found</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{task.title}</CardTitle>
          <CardDescription>Status: {task.status}</CardDescription>
        </CardHeader>
        <CardContent>
          <p><strong>Description:</strong> {task.description || "No description provided."}</p>
          {task.due_date && (
            <p><strong>Due Date:</strong> {new Date(task.due_date).toLocaleDateString()}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href="/projects">Back</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
