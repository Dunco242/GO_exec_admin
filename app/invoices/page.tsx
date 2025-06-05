"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Settings as SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import InvoiceSettingsModal from "app/components/InvoiceSettingsModal"; // Adjust path if needed
import { loadScript } from "@paypal/paypal-js";
import { useRouter, useSearchParams } from "next/navigation";

// Custom PayPal Button (SVG version)
const PayPalButton = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="24"
    viewBox="0 0 32 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-8 w-auto"
  >
    <rect x="0" y="0" width="32" height="24" rx="4" fill="#0070ba" />
    <path d="M9 16C10.5 16 11.7 14.8 11.7 13.3V13c0-.2-.1-.3-.2-.3H9.8c-.1 0-.2.1-.2.3v.3c0 .8-.7 1.3-1.5 1.3s-1.5-.5-1.5-1.3V11.7c0-.8.7-1.3 1.5-1.3h2.4c.8 0 1.5.5 1.5 1.3v1.6c0 .2.1.3.2.3h1.7c.1 0 .2-.1.2-.3v-.2c0-1.5-1.2-3-2.7-3H7.3c-1.5 0-2.7 1.5-2.7 3v2.6c0 1.5 1.2 3 2.7 3h1.7z" />
    <path d="M13 10.7c0-.8.7-1.3 1.5-1.3h2.4c.8 0 1.5.5 1.5 1.3v1.6c0 .2.1.3.2.3h1.7c.1 0 .2-.1.2-.3v-.2c0-1.5-1.2-3-2.7-3H16.2c-1.5 0-2.7 1.5-2.7 3v2.6c0 1.5 1.2 3 2.7 3h1.7" />
  </svg>
);

interface Client {
  id: number;
  name: string;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  status: "draft" | "pending" | "paid";
  total_amount: number | null;
  project_id: number | null;
  user_id: string;
  currency?: string | null;
  client: Client | null; // ✅ Now fetching full client object
}

interface ChartData {
  month: string;
  paid: number;
  pending: number;
}

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const getCurrentUserId = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  };

  const fetchInvoices = async () => {
    setLoading(true);
    const userId = await getCurrentUserId();
    if (!userId) {
      setCurrentUserId(null);
      setInvoices([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id,invoice_number,invoice_date,due_date,status,total_amount,project_id,user_id,currency,client:clients(id,name)"
        )
        .eq("user_id", userId)
        .order("invoice_date", { ascending: false });

      if (error) {
        console.error("Error fetching invoices:", error.message);
        toast({
          title: "Error",
          description: "Failed to load invoices.",
          variant: "destructive",
        });
        setInvoices([]);
        setLoading(false);
        return;
      }

      setInvoices(
        (data || []).map((inv: any) => ({
          ...inv,
          client: Array.isArray(inv.client) ? inv.client[0] || null : inv.client || null,
        }))
      );
    } catch (err: any) {
      console.error("Unexpected error fetching invoices:", err.message);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching invoices.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle payment status from URL parameters after PayPal redirect
  useEffect(() => {
    const paymentStatus = searchParams.get("payment_status");
    const invoiceId = searchParams.get("invoice_id");

    if (paymentStatus && invoiceId) {
      if (paymentStatus === "success") {
        toast({
          title: "Payment Successful!",
          description: `Invoice ${invoiceId} has been marked as paid.`,
          variant: "default",
        });

        router.replace("/invoices");
      } else if (paymentStatus === "cancelled") {
        toast({
          title: "Payment Cancelled",
          description: `Payment for Invoice ${invoiceId} was cancelled.`,
          variant: "default",
        });

        router.replace("/invoices");
      } else if (paymentStatus === "error") {
        toast({
          title: "Payment Error",
          description: `An error occurred during payment for Invoice ${invoiceId}.`,
          variant: "destructive",
        });

        router.replace("/invoices");
      }

      fetchInvoices(); // Refresh invoice list
    }
  }, [searchParams, router]);

  // Generate chart data for monthly invoicing overview
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const monthlyData: Record<string, { paid: number; pending: number }> = {};

    for (let i = 0; i < 12; i++) {
      const monthName = format(new Date(currentYear, i, 1), "MMM");
      monthlyData[monthName] = { paid: 0, pending: 0 };
    }

    invoices.forEach((invoice) => {
      if (
        invoice.invoice_date &&
        invoice.total_amount !== null &&
        invoice.status !== "draft"
      ) {
        const invoiceDate = parseISO(invoice.invoice_date);
        if (invoiceDate.getFullYear() === currentYear) {
          const monthName = format(invoiceDate, "MMM");
          if (monthlyData[monthName]) {
            if (invoice.status === "paid") {
              monthlyData[monthName].paid += invoice.total_amount;
            } else if (invoice.status === "pending") {
              monthlyData[monthName].pending += invoice.total_amount;
            }
          }
        }
      }
    });

    return Object.keys(monthlyData).map((month) => ({
      month,
      paid: parseFloat(monthlyData[month].paid.toFixed(2)),
      pending: parseFloat(monthlyData[month].pending.toFixed(2)),
    }));
  }, [invoices]);

  // PayPal Integration
  const handlePaypalPayment = async (invoice: Invoice) => {
    if (!invoice.total_amount) {
      toast({
        title: "Error",
        description: "This invoice has no amount. Cannot proceed with payment.",
        variant: "destructive",
      });
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to make a payment.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Preparing Payment...",
      description: "Please wait while we prepare your PayPal transaction.",
      duration: 3000,
    });

    try {
      const createOrderResponse = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });

      const orderData = await createOrderResponse.json();

      if (!createOrderResponse.ok || !orderData.orderId) {
        const errorMessage = orderData?.error || "Unknown error";
        console.error("PayPal Order Error:", orderData);
        toast({
          title: "Error",
          description: `Failed to create PayPal order: ${errorMessage}`,
          variant: "destructive",
        });
        return;
      }

      const paypalOrderId = orderData.orderId;

      const paypal = await loadScript({
        clientId: "sb", // Use sandbox test account
        currency: invoice.currency || "USD",
      });

      if (!paypal || typeof window === "undefined") {
        throw new Error("PayPal script failed to load.");
      }

      const containerId = `#paypal-button-container-${invoice.id}`;
      const container = document.querySelector(containerId);

      if (!container) {
        throw new Error(`Container ${containerId} not found.`);
      }

      container.innerHTML = ""; // Clear previous render

      if (
        window.paypal &&
        typeof window.paypal.Buttons === "function" &&
        window.paypal.FUNDING &&
        window.paypal.FUNDING.PAYPAL
      ) {
        window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING.PAYPAL,
          style: {
            layout: "horizontal",
            color: "gold",
            shape: "pill",
            label: "pay",
          },
          createOrder: () => {
            return paypalOrderId;
          },
          onApprove: async (data: any) => {
            try {
              const captureResponse = await fetch("/api/paypal/capture-order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-user-id": userId,
                },
                body: JSON.stringify({ orderId: data.orderID, invoiceId: invoice.id }),
              });

              const captureResult = await captureResponse.json();

              if (!captureResponse.ok) {
                throw new Error(captureResult.error || "Capture failed");
              }

              toast({
                title: "Payment Captured",
                description: `Your payment for invoice #${invoice.id} has been completed.`,
              });

              fetchInvoices(); // Refresh list

              router.push(`/invoices/success?invoice_id=${invoice.id}`);
            } catch (err: any) {
              console.error("Error in onApprove:", err?.message);
              toast({
                title: "Payment Error",
                description: typeof err?.message === "string" ? err.message : "An unexpected error occurred.",
                variant: "destructive",
              });
            }
          },
          onCancel: () => {
            toast({
              title: "Payment Cancelled",
              description: "You have cancelled the PayPal payment.",
              variant: "default",
            });
          },
          onError: (err: any) => {
            console.error("PayPal SDK Error:", err);
            toast({
              title: "Payment Error",
              description: typeof err?.message === "string" ? err.message : "An unexpected error occurred.",
              variant: "destructive",
            });
          },
        }).render(containerId);
      } else {
        toast({
          title: "PayPal Error",
          description: "PayPal SDK is not available.",
          variant: "destructive",
        });
      }

    } catch (err: any) {
      console.error("Server error during PayPal payment:", err.message);
      toast({
        title: "Internal Server Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <div className="flex items-center gap-4">
          <Button asChild>
            <Link href="/invoices/new">New Invoice</Link>
          </Button>
          <Button onClick={() => setShowSettingsModal(true)}>
            <SettingsIcon className="mr-2 h-4 w-4" /> Settings
          </Button>
        </div>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Invoicing Overview</CardTitle>
          <CardDescription>
            Paid vs Pending Invoices ({new Date().getFullYear()})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value: number | string, name: string) => [`$${value}`, name]} />
              <Legend />
              <Line type="monotone" dataKey="paid" stroke="#10B981" name="Paid" />
              <Line type="monotone" dataKey="pending" stroke="#F59E0B" name="Pending" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Manage your invoices here.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-400">
              Loading invoices...
            </p>
          ) : invoices.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-400">
              No invoices found.{" "}
              <Link href="/invoices/new" className="underline">
                Create New Invoice
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number || "N/A"}
                      </TableCell>
                      <TableCell>
                        {invoice.client?.name || "N/A"}{" "}
                        {/* ✅ Corrected to use client.name */}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(invoice.invoice_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date
                          ? format(parseISO(invoice.due_date), "MMM dd, yyyy")
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${invoice.total_amount?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            invoice.status === "paid"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : invoice.status === "pending"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          }`}
                        >
                          {invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {invoice.status === "pending" && (
                            <div
                              id={`paypal-button-container-${invoice.id}`}
                              className="h-12 flex justify-end"
                            >
                              <Button
                                variant="outline"
                                className="shadow-sm hover:shadow-md bg-[#0070ba] text-white hover:bg-[#005ea6]"
                                onClick={() => handlePaypalPayment(invoice)}
                                disabled={false}
                              >
                                <PayPalButton />
                              </Button>
                            </div>
                          )}
                          <Button size="sm" asChild>
                            <Link href={`/invoices/${invoice.id}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice Settings</DialogTitle>
            <DialogDescription>
              Configure settings related to invoices.
            </DialogDescription>
          </DialogHeader>
          {currentUserId && (
            <InvoiceSettingsModal onClose={() => setShowSettingsModal(false)} userId={""} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
