import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  styles,
  colors,
  formatCurrency,
  formatDate,
  getStatusColor,
} from "./shared-styles";

export interface InvoiceLineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  title: string;
  description: string | null;
  status: string;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  customer: {
    name: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
    billingAddress: string | null;
  };
  site: {
    name: string;
    address: string | null;
  } | null;
  workOrder: {
    workOrderNumber: string | null;
    title: string;
  } | null;
  lineItems: InvoiceLineItem[];
  orgName: string;
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{data.orgName}</Text>
            <Text style={styles.documentLabel}>INVOICE</Text>
          </View>
          <View>
            <Text style={styles.documentNumber}>{data.invoiceNumber}</Text>
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(data.status) },
              ]}
            >
              {data.status}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To / Invoice Details */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={styles.valueBold}>{data.customer.name}</Text>
            {data.customer.primaryEmail && (
              <Text style={styles.value}>{data.customer.primaryEmail}</Text>
            )}
            {data.customer.primaryPhone && (
              <Text style={styles.value}>{data.customer.primaryPhone}</Text>
            )}
            {data.customer.billingAddress && (
              <Text style={styles.value}>{data.customer.billingAddress}</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            <View style={{ flexDirection: "row", marginBottom: 3 }}>
              <Text style={[styles.label, { width: 70 }]}>Date:</Text>
              <Text style={styles.value}>{formatDate(data.createdAt)}</Text>
            </View>
            {data.dueDate && (
              <View style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={[styles.label, { width: 70 }]}>Due Date:</Text>
                <Text style={styles.value}>{formatDate(data.dueDate)}</Text>
              </View>
            )}
            {data.paidAt && (
              <View style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={[styles.label, { width: 70 }]}>Paid:</Text>
                <Text style={[styles.value, { color: colors.success }]}>
                  {formatDate(data.paidAt)}
                </Text>
              </View>
            )}
            {data.workOrder && (
              <View style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={[styles.label, { width: 70 }]}>Work Order:</Text>
                <Text style={styles.value}>
                  {data.workOrder.workOrderNumber || data.workOrder.title}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Title & Description */}
        <View style={{ marginTop: 16 }}>
          <Text style={styles.title}>{data.title}</Text>
          {data.description && (
            <Text style={styles.description}>{data.description}</Text>
          )}
        </View>

        {/* Line Items Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: "45%" }]}>
            Description
          </Text>
          <Text style={[styles.tableHeaderCell, { width: "12%" }]}>Type</Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: "10%", textAlign: "right" },
            ]}
          >
            Qty
          </Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: "15%", textAlign: "right" },
            ]}
          >
            Rate
          </Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: "18%", textAlign: "right" },
            ]}
          >
            Amount
          </Text>
        </View>

        {data.lineItems.map((item, index) => (
          <View
            key={item.id}
            style={index % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
          >
            <Text style={[styles.tableCell, { width: "45%" }]}>
              {item.description}
            </Text>
            <Text style={[styles.tableCellMuted, { width: "12%" }]}>
              {item.itemType}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: "10%", textAlign: "right" },
              ]}
            >
              {Number(item.quantity).toFixed(2)}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: "15%", textAlign: "right" },
              ]}
            >
              {formatCurrency(item.unitPrice)}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: "18%", textAlign: "right", fontFamily: "Helvetica-Bold" },
              ]}
            >
              {formatCurrency(item.totalPrice)}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal:</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(data.subtotal)}
            </Text>
          </View>
          {Number(data.tax) > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Tax ({Number(data.taxRate).toFixed(2)}%):
              </Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(data.tax)}
              </Text>
            </View>
          )}
          <View style={styles.totalsFinalRow}>
            <Text style={styles.totalsFinalLabel}>Total:</Text>
            <Text style={styles.totalsFinalValue}>
              {formatCurrency(data.total)}
            </Text>
          </View>
        </View>

        {/* Terms */}
        {data.terms && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Payment Terms</Text>
            <Text style={styles.notesText}>{data.terms}</Text>
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.orgName} - {data.invoiceNumber}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text style={styles.footerText}>
            Generated {new Date().toLocaleDateString("en-US")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
