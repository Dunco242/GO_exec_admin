// app/invoices/success/page.tsx
import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Use dynamic import to disable SSR for this component
const SuccessContent = () => {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoice_id");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="mb-4 flex justify-center">
          {/* Simple SVG icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-4"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.21" />
            <path d="M22 4L12 14.01 9 11.01" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Payment Successful!
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your payment has been processed successfully.
        </p>

        {invoiceId && (
          <p className="text-gray-700 dark:text-gray-200 mb-6">
            Invoice ID: <strong>{invoiceId}</strong>
          </p>
        )}

        <Link href="/invoices">
          <button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors">
            Return to Invoices
          </button>
        </Link>
      </div>
    </div>
  );
};

export default function SuccessPage() {
  return (
    <React.Suspense fallback="Loading...">
      <SuccessContent />
    </React.Suspense>
  );
}
