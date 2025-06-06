// app/invoices/success/page.tsx
import React from "react";
import Link from "next/link";

export default function SuccessPage() {
  // This page doesn't use useRouter or useSearchParams to avoid prerender errors
  // Invoice ID can be passed via router.push('/invoices/success?invoice_id=123') from client-side only

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="mb-4 flex justify-center">
          {/* You can replace this with your own SVG icon if needed */}
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
          Thank you for your payment. Your invoice has been processed.
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Note: For security reasons, invoice details are not shown here unless accessed directly from the app.
        </p>

        <Link href="/invoices">
          <button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors">
            Return to Invoices
          </button>
        </Link>
      </div>
    </div>
  );
}
