"use client";

import React from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import InvoicePdfDocument from './InvoicePdfDocument'; // Corrected import path relative to app/components/
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FullInvoiceData } from '../invoices/types'; // Corrected import path relative to app/components/

interface InvoicePreviewModalProps {
  invoiceData: FullInvoiceData;
  onClose: () => void;
}

export default function InvoicePreviewModal({ invoiceData, onClose }: InvoicePreviewModalProps) {

  const handleDownloadPdf = async () => {
    try {
      const blob = await pdf(<InvoicePdfDocument invoiceData={invoiceData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceData.invoice_number || 'untitled'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Clean up the URL object
    } catch (error) {
      console.error("Error generating PDF:", error);
      // You might want to add a toast message here for the user
    }
  };

  return (
    <DialogContent className="sm:max-w-[700px] h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Invoice Preview</DialogTitle>
        <DialogDescription>
          Review your invoice before saving.
        </DialogDescription>
      </DialogHeader>
      <div className="flex-1 min-h-0"> {/* This div ensures PDFViewer takes available space */}
        <PDFViewer width="100%" height="100%">
          <InvoicePdfDocument invoiceData={invoiceData} />
        </PDFViewer>
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={handleDownloadPdf}>Download PDF</Button>
      </div>
    </DialogContent>
  );
}
