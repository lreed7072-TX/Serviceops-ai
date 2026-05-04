import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { colors, formatDate } from "./shared-styles";

export interface PackingSlipLineItem {
  description: string;
  quantity: number;
  unit?: string | null;
}

export interface PackingSlipData {
  orderNumber: string;
  orderType: string;
  title: string;
  createdAt: string;
  customer: {
    name: string;
    primaryPhone: string | null;
  };
  site: {
    name: string;
    address: string | null;
  } | null;
  lineItems: PackingSlipLineItem[];
  notes: string | null;
  orgName: string;
}

const ps = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 50,
    paddingBottom: 70,
    color: colors.text,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  companyName: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary,
    textAlign: "right",
  },
  orderNumber: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
    marginTop: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  infoBlock: {
    width: "48%",
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 10,
    color: colors.text,
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 24,
  },
  colItem: {
    width: "10%",
    textAlign: "center",
  },
  colDescription: {
    width: "65%",
  },
  colQty: {
    width: "15%",
    textAlign: "center",
  },
  colUnit: {
    width: "10%",
    textAlign: "center",
  },
  headerText: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.muted,
    textTransform: "uppercase",
  },
  cellText: {
    fontSize: 10,
    color: colors.text,
  },
  checkBox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 2,
    marginHorizontal: "auto",
    marginTop: 1,
  },
  notesSection: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 10,
    color: colors.text,
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureLine: {
    width: "45%",
    borderTopWidth: 1,
    borderTopColor: colors.text,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: colors.muted,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 8,
    color: colors.light,
  },
});

export function PackingSlipDocument({ data }: { data: PackingSlipData }) {
  return (
    <Document>
      <Page size="LETTER" style={ps.page}>
        {/* Header */}
        <View style={ps.headerRow}>
          <View>
            <Text style={ps.companyName}>{data.orgName}</Text>
          </View>
          <View>
            <Text style={ps.docTitle}>PACKING SLIP</Text>
            <Text style={ps.orderNumber}>{data.orderNumber}</Text>
          </View>
        </View>

        <View style={ps.divider} />

        {/* Ship To / Order Info */}
        <View style={ps.infoRow}>
          <View style={ps.infoBlock}>
            <Text style={ps.infoLabel}>Ship To</Text>
            <Text style={ps.infoValue}>{data.customer.name}</Text>
            {data.site && (
              <Text style={ps.infoValue}>{data.site.name}</Text>
            )}
            {data.site?.address && (
              <Text style={ps.infoValue}>{data.site.address}</Text>
            )}
            {data.customer.primaryPhone && (
              <Text style={ps.infoValue}>{data.customer.primaryPhone}</Text>
            )}
          </View>
          <View style={ps.infoBlock}>
            <Text style={ps.infoLabel}>Order Details</Text>
            <Text style={ps.infoValue}>Order: {data.orderNumber}</Text>
            <Text style={ps.infoValue}>Type: {data.orderType.replace("_", " ")}</Text>
            <Text style={ps.infoValue}>Date: {formatDate(data.createdAt)}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 12, fontWeight: "bold", marginBottom: 12, color: colors.text }}>
          {data.title}
        </Text>

        {/* Items Table */}
        <View style={ps.tableHeader}>
          <Text style={[ps.headerText, ps.colItem]}>#</Text>
          <Text style={[ps.headerText, ps.colDescription]}>Description</Text>
          <Text style={[ps.headerText, ps.colQty]}>Qty</Text>
          <Text style={[ps.headerText, ps.colUnit]}>Received</Text>
        </View>

        {data.lineItems.map((item, i) => (
          <View key={i} style={ps.tableRow}>
            <Text style={[ps.cellText, ps.colItem]}>{i + 1}</Text>
            <Text style={[ps.cellText, ps.colDescription]}>{item.description}</Text>
            <Text style={[ps.cellText, ps.colQty]}>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</Text>
            <View style={ps.colUnit}>
              <View style={ps.checkBox} />
            </View>
          </View>
        ))}

        {/* Notes */}
        {data.notes && (
          <View style={ps.notesSection}>
            <Text style={ps.notesLabel}>Notes</Text>
            <Text style={ps.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Signature Lines */}
        <View style={ps.signatureSection}>
          <View style={ps.signatureLine}>
            <Text style={ps.signatureLabel}>Received By (Print Name)</Text>
          </View>
          <View style={ps.signatureLine}>
            <Text style={ps.signatureLabel}>Signature / Date</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={ps.footer}>
          {data.orgName} — Packing Slip for {data.orderNumber}
        </Text>
      </Page>
    </Document>
  );
}
