"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardFooter, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: "draft" | "pending" | "paid";
  total_amount: number;
  tax_percentage: number | null;
  notes: string | null;
  project_id: number; // Corrected to project_id as per schema
  user_name: string | null; // As per your schema
  created_at: string;
  invoice_items: InvoiceItem[];
  client: { id: number; name: string } | null; // Corrected to singular 'client' with id
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price_per_unit: number;
  total: number;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const { invoiceId } = params;
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedStatus, setEditedStatus] = useState<"draft" | "pending" | "paid">("draft");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("invoices")
          .select(`
            *,
            invoice_items (*),
            client:clients!fk_client ( id, name )
          `) // Removed inline comment from here
          .eq("id", invoiceId)
          .single();

        if (invoiceError) {
          setError(invoiceError.message);
          toast({ title: "Error", description: `Failed to load invoice: ${invoiceError.message}`, variant: "destructive" });
        } else if (invoiceData) {
          setInvoice(invoiceData as Invoice);
          setEditedStatus(invoiceData.status);
        } else {
          setError("Invoice not found.");
          toast({ title: "Error", description: "Invoice not found.", variant: "destructive" });
        }
      } catch (err: any) {
        setError(err.message);
        toast({ title: "Error", description: `An unexpected error occurred: ${err.message}`, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    if (invoiceId) {
      fetchInvoiceDetails();
    }
  }, [invoiceId, toast]);

  const handleStatusChange = async () => {
    if (!invoice || editedStatus === invoice.status) {
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: editedStatus })
        .eq("id", invoice.id);

      if (updateError) {
        toast({ title: "Error", description: `Failed to update status: ${updateError.message}`, variant: "destructive" });
      } else {
        setInvoice((prevInvoice) =>
          prevInvoice ? { ...prevInvoice, status: editedStatus } : null
        );
        toast({ title: "Success", description: "Invoice status updated successfully.", variant: "default" }); // Changed variant to "default"
      }
    } catch (err: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${err.message}`, variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading invoice details...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">Error loading invoice: {error}</div>;
  }

  if (!invoice) {
    return <div className="p-6 text-center">Invoice not found.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold">Invoice: {invoice.invoice_number}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>Invoice Number:</strong> {invoice.invoice_number}</p>
              <p><strong>Invoice Date:</strong> {format(parseISO(invoice.invoice_date), 'MMMM dd,yyyy')}</p>
              {invoice.due_date && (
                <p><strong>Due Date:</strong> {format(parseISO(invoice.due_date), 'MMMM dd,yyyy')}</p>
              )}
            </div>
            <div>
              {invoice.client && <p><strong>Client:</strong> {invoice.client.name}</p>}
              {invoice.user_name && <p><strong>Issued By:</strong> {invoice.user_name}</p>}
              {invoice.tax_percentage !== null && (
                <p><strong>Tax:</strong> {invoice.tax_percentage}%</p>
              )}
              <p><strong>Total Amount:</strong> ${invoice.total_amount.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <strong className="min-w-[60px]">Status:</strong>
            <Select onValueChange={(value: "draft" | "pending" | "paid") => setEditedStatus(value)} value={editedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            {editedStatus !== invoice.status && (
              <Button onClick={handleStatusChange} disabled={isUpdatingStatus}>
                {isUpdatingStatus ? 'Saving...' : 'Save Status'}
              </Button>
            )}
          </div>

          {invoice.notes && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Notes</h3>
              <p className="text-gray-700">{invoice.notes}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-2">Invoice Items</h3>
            {invoice.invoice_items && invoice.invoice_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200">
                  <thead>
                    <tr>
                      <th className="p-2 border border-gray-200 text-left">Description</th>
                      <th className="p-2 border border-gray-200 text-right">Quantity</th>
                      <th className="p-2 border border-gray-200 text-right">Unit Price</th>
                      <th className="p-2 border border-gray-200 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.invoice_items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2 border border-gray-200">{item.description}</td>
                        <td className="p-2 border border-gray-200 text-right">{item.quantity}</td>
                        <td className="p-2 border border-gray-200 text-right">${item.price_per_unit.toFixed(2)}</td>
                        <td className="p-2 border border-gray-200 text-right">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="p-2 border border-gray-200 text-right font-semibold">Subtotal:</td>
                      <td className="p-2 border border-gray-200 text-right">${(invoice.total_amount - (invoice.total_amount * (invoice.tax_percentage || 0) / 100)).toFixed(2)}</td>
                    </tr>
                    {invoice.tax_percentage !== null && (
                      <tr>
                        <td colSpan={3} className="p-2 border border-gray-200 text-right font-semibold">Tax ({invoice.tax_percentage}%):</td>
                        <td className="p-2 border border-gray-200 text-right">${(invoice.total_amount * (invoice.tax_percentage / 100)).toFixed(2)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="p-2 border border-gray-200 text-right font-bold">Total:</td>
                      <td className="p-2 border border-gray-200 text-right">${invoice.total_amount.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p>No invoice items found.</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/invoices" passHref>
            <Button variant="secondary">Back to Invoices</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
