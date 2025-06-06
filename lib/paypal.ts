// lib/paypal.ts
import { loadScript } from "@paypal/paypal-js";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";

export const initPayPal = async (
  invoice: any,
  fetchInvoices: () => void,
  router: ReturnType<typeof useRouter>
) => {
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
      throw new Error(orderData?.error || "Unknown error");
    }

    const paypalOrderId = orderData.orderId;

    const paypal = await loadScript({
      clientId: "sb",
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

    if (window.paypal && typeof window.paypal.Buttons === "function") {
      window.paypal.Buttons({
        fundingSource: window.paypal.FUNDING?.PAYPAL,
        style: {
          layout: "horizontal",
          color: "gold",
          shape: "pill",
          label: "pay",
        },
        createOrder: () => {
          return paypalOrderId;
        },
        onApprove: async (data, actions) => {
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

            fetchInvoices();
            router.push(`/invoices/success?invoice_id=${invoice.id}`);
          } catch (err: any) {
            console.error("Error in onApprove:", err.message);
            toast({
              title: "Payment Error",
              description: typeof err === "string"
                ? err
                : (err && typeof err.message === "string"
                    ? err.message
                    : "An unexpected error occurred."),
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
        onError: (err) => {
          console.error("PayPal SDK Error:", err);
          toast({
            title: "Payment Error",
            description: String(err?.message || "An unexpected error occurred."),
            variant: "destructive",
          });
        },
      }).render(containerId);
    } else {
      throw new Error("PayPal Buttons are not available on window.");
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

const getCurrentUserId = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
};
