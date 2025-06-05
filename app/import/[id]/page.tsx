"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";

interface ImportedNote {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export default function NoteDetailPage() {
  const params = useParams();
  const [note, setNote] = useState<ImportedNote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNote = async () => {
      const id = parseInt(params.id as string, 10);
      if (isNaN(id)) return;

      const { data, error } = await supabase
        .from("imported_notes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching note:", error.message);
        return;
      }

      setNote(data);
      setLoading(false);
    };

    fetchNote();
  }, [params.id]);

  if (loading) return <div>Loading...</div>;
  if (!note) return <div>Note not found</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{note.title}</CardTitle>
          <CardDescription>Created: {new Date(note.created_at).toLocaleDateString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>{note.content}</p>
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
