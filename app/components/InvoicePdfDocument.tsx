"use client";

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';
import { FullInvoiceData, InvoiceItem } from '../invoices/types'; // Corrected import path

// Register a font if you want to use custom fonts, otherwise default will be used
// Font.register({ family: 'Inter', src: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap' }); // This won't work directly, need to provide font file or base64

// For simplicity, let's use a standard font or provide a local one if available in your project
// Font.register({ family: 'Roboto', src: '/fonts/Roboto-Regular.ttf' });

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica', // Default font
    fontSize: 10,
    color: '#333',
  },
  section: {
    marginBottom: 15,
  },
  header: {
    fontSize: 20,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#2660ff', // Primary color
  },
  subHeader: {
    fontSize: 14,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  text: {
    marginBottom: 3,
  },
  table: {
    display: 'flex', // Corrected from 'table' to 'flex' for react-pdf
    flexDirection: 'column', // Ensures rows stack vertically
    width: 'auto',
    marginBottom: 10,
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row', // Each row is a flex container
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableColHeader: {
    width: '20%',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderBottomColor: '#000',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
    backgroundColor: '#f2f2f2',
    fontWeight: 'bold',
  },
  tableCol: {
    width: '20%',
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  descriptionCol: {
    width: '40%', // Wider for description
    borderStyle: 'solid',
    borderColor: '#bfbfbf',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  summaryLabel: {
    width: '25%',
    textAlign: 'right',
    marginRight: 10,
  },
  summaryValue: {
    width: '15%',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  notes: {
    marginTop: 20,
    fontSize: 9,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'grey',
    fontSize: 8,
  }
});

const InvoicePdfDocument = ({ invoiceData }: { invoiceData: FullInvoiceData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.header}>INVOICE</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.text}>Invoice #: {invoiceData.invoice_number}</Text>
        <Text style={styles.text}>Invoice Date: {format(parseISO(invoiceData.invoice_date), 'MMM dd,yyyy')}</Text>
        <Text style={styles.text}>Due Date: {invoiceData.due_date ? format(parseISO(invoiceData.due_date), 'MMM dd,yyyy') : 'N/A'}</Text>
        <Text style={styles.text}>Status: {invoiceData.status.charAt(0).toUpperCase() + invoiceData.status.slice(1)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subHeader}>Bill To:</Text>
        <Text style={styles.text}>{invoiceData.client_name}</Text>
        {/* Add client address here if available in your client data */}
      </View>

      <View style={styles.section}>
        <Text style={styles.subHeader}>Issued By:</Text>
        <Text style={styles.text}>{invoiceData.user_name}</Text>
        {/* Add your company/user address here if available */}
      </View>

      <View style={styles.table}>
        <View style={styles.tableRow}>
          <Text style={styles.descriptionCol}>Description</Text>
          <Text style={styles.tableColHeader}>Qty</Text>
          <Text style={styles.tableColHeader}>Unit Price</Text>
          <Text style={styles.tableColHeader}>Total</Text>
        </View>
        {invoiceData.items.map((item: InvoiceItem, index: number) => (
          <View key={index} style={styles.tableRow}>
            <Text style={styles.descriptionCol}>{item.description}</Text>
            <Text style={styles.tableCol}>{item.quantity}</Text>
            <Text style={styles.tableCol}>${item.price_per_unit.toFixed(2)}</Text>
            <Text style={styles.tableCol}>${item.total.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal:</Text>
          <Text style={styles.summaryValue}>${invoiceData.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax ({invoiceData.tax_percentage}%):</Text>
          <Text style={styles.summaryValue}>${invoiceData.tax_amount.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total:</Text>
          <Text style={styles.summaryValue}>${invoiceData.total.toFixed(2)}</Text>
        </View>
      </View>

      {invoiceData.notes && (
        <View style={styles.section}>
          <Text style={styles.subHeader}>Notes:</Text>
          <Text style={styles.notes}>{invoiceData.notes}</Text>
        </View>
      )}

      <Text style={styles.footer} fixed>
        Thank you for your business!
      </Text>
    </Page>
  </Document>
);

export default InvoicePdfDocument;
