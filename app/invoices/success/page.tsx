"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const invoiceId = searchParams.get("invoice_id");

  useEffect(() => {
    if (!invoiceId) {
      toast({
        title: "Payment Successful",
        description: "Thank you for your payment!",
        variant: "default",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: `Invoice ${invoiceId} has been paid.`,
        variant: "default",
      });
    }

    // Optionally redirect to main invoices list after a short delay
    const timer = setTimeout(() => {
      router.push("/invoices");
    }, 3000);

    return () => clearTimeout(timer);
  }, [invoiceId]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <CheckCircle className="h-20 w-20 text-green-600 mb-4" />
      <h1 className="text-3xl font-bold">Payment Successful!</h1>
      <p className="mt-2 text-lg text-gray-600">
        Thank you for your payment.
      </p>
      {invoiceId && (
        <p className="mt-1 text-sm text-muted-foreground">
          Invoice ID: {invoiceId}
        </p>
      )}
      <p className="mt-6 text-sm text-gray-500">
        Redirecting back to your dashboard...
      </p>
    </div>
  );
}
