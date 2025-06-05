"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import InvoicePreviewModal from "app/components/InvoicePreviewModal";
import { FullInvoiceData, InvoiceItem } from "../types";

interface Client {
  id: number;
  name: string;
}

// Helper function to generate an invoice number
const generateInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV-${year}-${month}-${day}-${randomSuffix}`;
};

export default function CreateInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<string[]>([]); // State to hold usernames from user_settings
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null); // Changed to selectedUserName
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null); // To store the actual auth.uid()
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [status, setStatus] = useState<"draft" | "pending" | "paid">("draft");
  const [taxPercentage, setTaxPercentage] = useState<number>(0);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, price_per_unit: 0, total: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewInvoiceData, setPreviewInvoiceData] = useState<FullInvoiceData | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch current authenticated user ID
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error("User not authenticated:", userError?.message);
          toast({
            title: "Authentication Error",
            description: "Please log in to create invoices.",
            variant: "destructive",
          });
          return;
        }
        setCurrentAuthUserId(user.id);

        // Fetch clients
        const { data: clientsData, error: clientsError } = await supabase
          .from("clients")
          .select("id, name");
        if (clientsError) {
          console.error("Error fetching clients:", clientsError);
          toast({ title: "Error fetching clients", description: clientsError.message, variant: "destructive" });
        } else {
          setClients(clientsData || []);
        }

        // Fetch usernames from user_settings
        const { data: usersData, error: usersError } = await supabase
          .from("user_settings")
          .select("user_id, user_name"); // Select user_id as well to match with auth.uid()
        if (usersError) {
          console.error("Error fetching users:", usersError);
          toast({ title: "Error fetching users", description: usersError.message, variant: "destructive" });
        } else {
          // Filter to only include the current authenticated user's username
          const filteredUsers = usersData
            ?.filter(u => u.user_id === user.id)
            .map(u => u.user_name) || [];
          setUsers(filteredUsers);

          // Automatically select the current user's username if available
          if (filteredUsers.length > 0) {
            setSelectedUserName(filteredUsers[0]);
          }
        }
      } catch (error: any) {
        console.error("Error fetching initial data:", error);
        toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
      }
    };

    fetchInitialData();
  }, [toast]);

  const handleClientSelect = (clientId: number) => {
    setSelectedClientId(clientId);
  };

  const handleUserSelect = (username: string) => {
    setSelectedUserName(username); // Now the selected value is the username
  };

  const handleAddItem = () => {
    setInvoiceItems((prevItems) => [
      ...prevItems,
      { id: crypto.randomUUID(), description: "", quantity: 1, price_per_unit: 0, total: 0 },
    ]);
  };

  const handleRemoveItem = (idToRemove: string) => {
    setInvoiceItems((prevItems) => prevItems.filter((item) => item.id !== idToRemove));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setInvoiceItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          const quantity = typeof updatedItem.quantity === 'string' ? parseFloat(updatedItem.quantity) : updatedItem.quantity;
          const price = typeof updatedItem.price_per_unit === 'string' ? parseFloat(updatedItem.price_per_unit) : updatedItem.price_per_unit;
          return { ...updatedItem, total: (quantity || 0) * (price || 0) };
        }
        return item;
      })
    );
  };

  const calculateSubtotal = () => {
    return invoiceItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * (taxPercentage / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const validateInvoice = (): boolean => {
    if (!selectedClientId) {
      toast({ title: "Validation Error", description: "Please select a client.", variant: "destructive" });
      return false;
    }
    if (!currentAuthUserId) { // Validate against the actual authenticated user ID
      toast({ title: "Validation Error", description: "User not authenticated. Cannot create invoice.", variant: "destructive" });
      return false;
    }
    if (!invoiceNumber.trim()) {
      toast({ title: "Validation Error", description: "Invoice number is required.", variant: "destructive" });
      return false;
    }
    if (invoiceItems.length === 0 || invoiceItems.some(item => !item.description.trim() || item.quantity <= 0 || item.price_per_unit <= 0)) {
      toast({ title: "Validation Error", description: "Please add at least one valid invoice item with description, quantity > 0, and price > 0.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handlePreviewInvoice = () => {
    if (!validateInvoice()) {
      return;
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);

    if (!selectedClient) {
      toast({ title: "Error", description: "Client data not found for preview.", variant: "destructive" });
      return;
    }

    const dataToPreview: FullInvoiceData = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate.toISOString().split('T')[0],
      due_date: dueDate?.toISOString().split('T')[0] || null,
      status,
      tax_percentage: taxPercentage,
      notes,
      client_name: selectedClient.name,
      user_name: selectedUserName || "", // Using the selected username
      items: invoiceItems,
      subtotal: calculateSubtotal(),
      tax_amount: calculateTax(),
      total: calculateTotal(),
    };

    setPreviewInvoiceData(dataToPreview);
    setShowPreviewModal(true);
  };

  const handleCreateInvoice = async () => {
    if (!validateInvoice()) {
      return;
    }

    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          client_id: selectedClientId,
          user_id: currentAuthUserId, // Use the actual authenticated user ID here
          user_name: selectedUserName, // Store the selected username
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate.toISOString().split('T')[0],
          due_date: dueDate?.toISOString().split('T')[0] || null,
          status,
          total_amount: calculateTotal(),
          tax_percentage: taxPercentage,
          notes,
        })
        .select("id")
        .single();

      if (invoiceError) {
        console.error("Error creating invoice:", invoiceError);
        toast({ title: "Error creating invoice", description: invoiceError.message, variant: "destructive" });
        return;
      }

      if (invoiceData?.id) {
        const itemsToInsert = invoiceItems.map(item => ({
          invoice_id: invoiceData.id,
          description: item.description,
          quantity: item.quantity,
          price_per_unit: item.price_per_unit,
          total: item.total,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(itemsToInsert);

        if (itemsError) {
          console.error("Error creating invoice items:", itemsError);
          toast({ title: "Error creating invoice items", description: itemsError.message, variant: "destructive" });
          return;
        }

        toast({ title: "Success", description: "Invoice created successfully." });
        router.push(`/invoices/${invoiceData.id}`);
      }
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      toast({ title: "Error creating invoice", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-6">Create New Invoice</h1>
      <Card className="shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        <CardHeader className="p-6 border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="text-2xl font-semibold text-gray-900 dark:text-white">Invoice Details</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">Enter the details for the new invoice.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client">Client</Label>
              <Select onValueChange={(value) => handleClientSelect(parseInt(value))} value={selectedClientId?.toString() || ""}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="user">Issued By</Label>
              <Select onValueChange={handleUserSelect} value={selectedUserName || ""}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select User" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((username) => (
                    <SelectItem key={username} value={username}>
                      {username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                readOnly
                placeholder="Automatic Invoice Number"
              />
            </div>
            <div>
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate.toISOString().split('T')[0]}
                onChange={(e) => setInvoiceDate(new Date(e.target.value))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dueDate">Due Date (Optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate?.toISOString().split('T')[0] || ""}
              onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value) : null)}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select onValueChange={(value: "draft" | "pending" | "paid") => setStatus(value)} value={status}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="taxPercentage">Tax Percentage (%)</Label>
            <Input
              id="taxPercentage"
              type="number"
              min="0"
              step="0.01"
              value={taxPercentage.toString()}
              onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
              placeholder="e.g., 5.00"
            />
          </div>

          <div className="space-y-4">
            <Label className="text-lg font-medium">Invoice Items</Label>
            {invoiceItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end p-3 border rounded-md shadow-sm bg-gray-50 dark:bg-gray-700">
                <div className="md:col-span-2">
                  <Label htmlFor={`description-${item.id}`}>Description</Label>
                  <Input
                    id={`description-${item.id}`}
                    value={item.description}
                    onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                    placeholder="Service or product description"
                  />
                </div>
                <div>
                  <Label htmlFor={`quantity-${item.id}`}>Qty</Label>
                  <Input
                    id={`quantity-${item.id}`}
                    type="number"
                    min="1"
                    value={item.quantity.toString()}
                    onChange={(e) => handleItemChange(item.id, "quantity", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor={`price-${item.id}`}>Price</Label>
                  <Input
                    id={`price-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price_per_unit.toString()}
                    onChange={(e) => handleItemChange(item.id, "price_per_unit", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex flex-col">
                  <Label>Total</Label>
                  <Input value={item.total.toFixed(2)} readOnly className="bg-gray-100 dark:bg-gray-600" />
                </div>
                {invoiceItems.length > 1 && (
                  <Button variant="destructive" size="sm" onClick={() => handleRemoveItem(item.id)} className="w-full md:w-auto">
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" size="sm" onClick={handleAddItem} className="shadow-sm hover:shadow-md">Add Item</Button>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the invoice..."
              rows={3}
            />
          </div>

          <div className="mt-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-700 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Summary</h2>
            <div className="grid grid-cols-2 gap-2 text-base">
              <div className="font-medium">Subtotal:</div>
              <div className="text-right">${calculateSubtotal().toFixed(2)}</div>
              <div className="font-medium">Tax ({taxPercentage}%):</div>
              <div className="text-right">${calculateTax().toFixed(2)}</div>
              <div className="font-bold text-lg">Total:</div>
              <div className="text-right font-bold text-lg">${calculateTotal().toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={() => router.back()} className="shadow-md hover:shadow-lg">
            Cancel
          </Button>
          <Button onClick={handlePreviewInvoice} className="px-6 py-3 text-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out">
            Preview Invoice
          </Button>
          <Button onClick={handleCreateInvoice} className="px-6 py-3 text-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out">
            Create Invoice
          </Button>
        </CardFooter>
      </Card>

      {/* Invoice Preview Modal */}
      {previewInvoiceData && (
        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <InvoicePreviewModal
            invoiceData={previewInvoiceData}
            onClose={() => setShowPreviewModal(false)}
          />
        </Dialog>
      )}
    </div>
  );
}
