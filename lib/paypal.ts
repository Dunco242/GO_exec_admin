// lib/paypal.ts
import { loadScript } from '@paypal/paypal-js';
import { supabase } from '@/lib/supabaseClient'; // Assuming supabase client is available
import { toast } from '@/components/ui/use-toast';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

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
    client: { name: string } | null;
}

export const initPayPal = async (
    invoice: Invoice,
    fetchInvoices: () => Promise<void>,
    router: AppRouterInstance // Use AppRouterInstance type
) => {
    if (!invoice.total_amount) {
        toast({
            title: "Error",
            description: "Invoice has no total amount to pay.",
            variant: "destructive",
        });
        return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const userId = user?.id;

    if (userError || !userId) {
        toast({
            title: "Error",
            description: "User not authenticated for payment.",
            variant: "destructive",
        });
        return;
    }

    toast({
        title: "Initiating PayPal Payment...",
        description: "Please wait while we prepare your payment.",
    });

    try {
        // Step 1: Call your backend API to create a PayPal order
        const createOrderResponse = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
            },
            body: JSON.stringify({ invoiceId: invoice.id }),
        });

        const orderData = await createOrderResponse.json();

        if (!createOrderResponse.ok || !orderData.orderId) {
            throw new Error(orderData.error || 'Failed to create PayPal order.');
        }

        const paypalOrderId = orderData.orderId;

        // Step 2: Load PayPal SDK and render the button for user approval
        // ✅ CRITICAL: Only load PayPal script in the browser
        if (typeof window !== 'undefined') {
            const paypal = await loadScript({
                clientId: "sb", // Use "sb" for sandbox or your client ID for production
                currency: invoice.currency || 'USD',
            });

            if (paypal) {
                // Check if buttons have already been rendered for this invoice to prevent re-rendering
                if (document.getElementById(`paypal-button-container-${invoice.id}`)?.firstChild) {
                    console.warn(`PayPal buttons already rendered for invoice ${invoice.id}. Skipping.`);
                    return;
                }

                if (typeof paypal.Buttons === "function") {
                    paypal.Buttons({
                        createOrder: async (data, actions) => {
                            return paypalOrderId;
                        },
                        onApprove: async (data, actions) => {
                            toast({
                                title: "Payment Approved!",
                                description: "Completing your transaction...",
                            });

                            const captureResponse = await fetch('/api/paypal/capture-order', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'x-user-id': userId,
                                },
                                body: JSON.stringify({ orderId: data.orderID, invoiceId: invoice.id }),
                            });

                            const captureResult = await captureResponse.json();

                            if (!captureResponse.ok) {
                                throw new Error(captureResult.error || 'Failed to capture PayPal payment.');
                            }

                            toast({
                                title: "Payment Complete!",
                                description: captureResult.message || `Invoice ${invoice.invoice_number} paid successfully.`,
                                variant: "default", // Changed from "success" to "default" as per your previous common usage
                            });
                            fetchInvoices(); // Refresh invoices list
                        },
                        onCancel: (data) => {
                            toast({
                                title: "Payment Cancelled",
                                description: "You have cancelled the PayPal payment.",
                                variant: "default",
                            });
                            console.log('PayPal Payment cancelled:', data);
                        },
                        onError: (err) => {
                            toast({
                                title: "Payment Error",
                                description: (typeof err === "object" && err !== null && "message" in err && typeof (err as any).message === "string")
                                    ? (err as any).message
                                    : "An error occurred during PayPal payment.",
                                variant: "destructive",
                            });
                            console.error('PayPal Payment Error:', err);
                        }
                    }).render(`#paypal-button-container-${invoice.id}`).catch((err: any) => {
                        console.error("Error rendering PayPal Buttons:", err);
                        toast({
                            title: "PayPal Render Error",
                            description: "Could not display PayPal buttons. Please try again.",
                            variant: "destructive"
                        });
                    });
                } else {
                    console.error("PayPal Buttons is not available.");
                    toast({
                        title: "Payment Error",
                        description: "PayPal Buttons is not available. Please try again.",
                        variant: "destructive",
                    });
                }
            } else {
                console.error("PayPal script failed to load.");
                toast({
                    title: "Payment Error",
                    description: "PayPal script failed to load. Please try again.",
                    variant: "destructive",
                });
            }
        } else {
            // This path should ideally not be hit with "use client" and dynamic import,
            // but is a safeguard if this module is evaluated server-side.
            console.warn("Attempted to load PayPal script in non-browser environment.");
            toast({
                title: "Payment Error",
                description: "PayPal payment is not available in this environment.",
                variant: "destructive",
            });
        }
    } catch (error: any) {
        toast({
            title: "Payment Error",
            description: error.message || "An unexpected error occurred during PayPal payment initiation.",
            variant: "destructive",
        });
        console.error('PayPal Integration Error:', error);
    }
};
