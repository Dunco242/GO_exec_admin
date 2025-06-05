// app/invoices/types.ts

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price_per_unit: number;
  total: number;
}

export interface FullInvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: "draft" | "pending" | "paid";
  tax_percentage: number;
  notes: string;
  client_name: string;
  user_name: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_amount: number;
  total: number;
}
