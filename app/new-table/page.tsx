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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Define interface matching your new table structure
interface NewTableItem {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
}

export default function NewTablePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<NewTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openAddModal, setOpenAddModal] = useState(false);
  const [newItemData, setNewItemData] = useState({
    name: "",
    description: "",
  });

  // Fetch items on mount
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase.from("your_new_table_name").select("*");

      if (error) {
        throw error;
      }

      setItems(data as NewTableItem[]);
    } catch (err: any) {
      console.error("Error fetching new table items:", err.message);
      setError(`Failed to load data: ${err.message}`);
      toast({
        title: "Error",
        description: `Failed to load table data: ${err.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewItem = async () => {
    const { name, description } = newItemData;

    if (!name.trim()) {
      toast({
        title: "Validation Failed",
        description: "Name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("your_new_table_name").insert([
        {
          name,
          description: description || null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `"${name}" has been added.`,
      });

      setOpenAddModal(false);
      setNewItemData({ name: "", description: "" });
      fetchItems();
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to create item: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-6">
            <h3 className="text-lg font-medium">Error</h3>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button className="mt-4" onClick={fetchItems}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6">New Table</h1>
        <Card className="py-12 px-6 text-center shadow-none border-dashed border-2 border-muted-foreground/20">
          <p className="text-muted-foreground mb-4">
            This table is empty.
          </p>
          <Button onClick={() => setOpenAddModal(true)}>Add Your First Item</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">New Table</h1>
        <Button onClick={() => setOpenAddModal(true)}>Add New Item</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/new-table/${item.id}`)}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
              <CardDescription>{item.description || "No description provided."}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Created at: {new Date(item.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Modal */}
      <Dialog open={openAddModal} onOpenChange={setOpenAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>Fill in the details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={newItemData.name}
                onChange={(e) =>
                  setNewItemData({ ...newItemData, name: e.target.value })
                }
                placeholder="Enter name"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right pt-2">Description</Label>
              <textarea
                id="description"
                value={newItemData.description || ""}
                onChange={(e) =>
                  setNewItemData({ ...newItemData, description: e.target.value })
                }
                rows={3}
                className="col-span-3 border rounded-md p-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewItem}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
