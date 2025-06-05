"use client";

import React, { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface NoteImportModalProps {
  userId: string;
  onImportSuccess: () => void; // Callback to refresh notes list
  onClose: () => void;
}

export default function NoteImportModal({ userId, onImportSuccess, onClose }: NoteImportModalProps) {
  const [noteTitle, setNoteTitle] = useState<string>("");
  const [noteContent, setNoteContent] = useState<string>("");
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!noteTitle.trim()) {
      toast({
        title: "Validation Error",
        description: "Note title cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (!noteContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Note content cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: userId,
          title: noteTitle,
          content: noteContent,
        })
        .select();

      if (error) {
        console.error("Error importing note:", error.message);
        toast({
          title: "Import Error",
          description: `Failed to import note: ${error.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Note Imported",
          description: "Your content has been successfully saved as a new note.",
          variant: "default",
        });
        onImportSuccess(); // Trigger refresh of notes list
        onClose(); // Close the modal
      }
    } catch (err: any) {
      console.error("Unexpected error during import:", err.message);
      toast({
        title: "Error",
        description: `An unexpected error occurred: ${err.message}`,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Import New Note</DialogTitle>
        <DialogDescription>
          Paste your text content below to create a new note.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="noteTitle">Note Title</Label>
          <Input
            id="noteTitle"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="e.g., Meeting Minutes 2024-06-03"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="noteContent">Note Content</Label>
          <Textarea
            id="noteContent"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Paste your text here..."
            rows={10}
            className="resize-y"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isImporting}>
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={isImporting}>
          {isImporting ? "Importing..." : "Import Note"}
        </Button>
      </div>
    </DialogContent>
  );
}
