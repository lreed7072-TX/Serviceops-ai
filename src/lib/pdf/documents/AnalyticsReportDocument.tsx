import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  styles,
  colors,
  formatCurrency,
  formatDate,
} from "./shared-styles";

interface RevenueRow {
  invoiceNumber: string;
  date: string;
  customer: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  paidDate: string | null;
}

interface WorkOrderRow {
  workOrderNumber: string;
  date: string;
  customer: string;
  site: string;
  title: string;
  status: string;
  orderType: string;
}

interface MaterialRow {
  date: string;
  name: string;
  partNumber: string;
  category: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface QuoteRow {
  quoteNumber: string;
  date: string;
  customer: string;
  status: string;
  total: number;
  sentDate: string | null;
  approvedDate: string | null;
  validUntil: string | null;
}

export interface AnalyticsData {
  reportType: "revenue" | "work-orders" | "materials" | "quotes";
  dateRange: { from: string; to: string };
  orgName: string;
  revenue?: {
    rows: RevenueRow[];
    totalRevenue: number;
    totalPaid: number;
    totalOutstanding: number;
    invoiceCount: number;
  };
  workOrders?: {
    rows: WorkOrderRow[];
    totalCount: number;
    completedCount: number;
    openCount: number;
  };
  materials?: {
    rows: MaterialRow[];
    totalCost: number;
    totalItems: number;
  };
  quotes?: {
    rows: QuoteRow[];
    totalValue: number;
    approvedCount: number;
    pendingCount: number;
    conversionRate: number;
  };
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View
      style={{
        width: "23%",
        backgroundColor: colors.background,
        padding: 12,
        borderRadius: 4,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontFamily: "Helvetica-Bold",
          color: color || colors.text,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 8, color: colors.muted, marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}

export function AnalyticsReportDocument({ data }: { data: AnalyticsData }) {
  const reportTitles: Record<string, string> = {
    revenue: "Revenue Report",
    "work-orders": "Work Orders Report",
    materials: "Materials Usage Report",
    quotes: "Quotes Report",
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{data.orgName}</Text>
            <Text style={styles.documentLabel}>
              {reportTitles[data.reportType]}
            </Text>
          </View>
          <View>
            <Text style={[styles.label, { textAlign: "right" }]}>
              {formatDate(data.dateRange.from)} - {formatDate(data.dateRange.to)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Revenue Report */}
        {data.reportType === "revenue" && data.revenue && (
          <View>
            {/* Summary Cards */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <SummaryCard
                label="Total Revenue"
                value={formatCurrency(data.revenue.totalRevenue)}
                color={colors.accent}
              />
              <SummaryCard
                label="Paid"
                value={formatCurrency(data.revenue.totalPaid)}
                color={colors.success}
              />
              <SummaryCard
                label="Outstanding"
                value={formatCurrency(data.revenue.totalOutstanding)}
                color={colors.warning}
              />
              <SummaryCard
                label="Invoices"
                value={String(data.revenue.invoiceCount)}
              />
            </View>

            {/* Table */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: "14%" }]}>
                Invoice
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
                Date
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "24%" }]}>
                Customer
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
                Status
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "14%", textAlign: "right" },
                ]}
              >
                Subtotal
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "10%", textAlign: "right" },
                ]}
              >
                Tax
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "14%", textAlign: "right" },
                ]}
              >
                Total
              </Text>
            </View>

            {data.revenue.rows.map((row, i) => (
              <View
                key={i}
                style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
              >
                <Text style={[styles.tableCell, { width: "14%" }]}>
                  {row.invoiceNumber}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "12%" }]}>
                  {formatDate(row.date)}
                </Text>
                <Text style={[styles.tableCell, { width: "24%" }]}>
                  {row.customer}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "12%", fontSize: 8 },
                  ]}
                >
                  {row.status}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "14%", textAlign: "right" },
                  ]}
                >
                  {formatCurrency(row.subtotal)}
                </Text>
                <Text
                  style={[
                    styles.tableCellMuted,
                    { width: "10%", textAlign: "right" },
                  ]}
                >
                  {formatCurrency(row.tax)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      width: "14%",
                      textAlign: "right",
                      fontFamily: "Helvetica-Bold",
                    },
                  ]}
                >
                  {formatCurrency(row.total)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Work Orders Report */}
        {data.reportType === "work-orders" && data.workOrders && (
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <SummaryCard
                label="Total Work Orders"
                value={String(data.workOrders.totalCount)}
                color={colors.accent}
              />
              <SummaryCard
                label="Completed"
                value={String(data.workOrders.completedCount)}
                color={colors.success}
              />
              <SummaryCard
                label="Open"
                value={String(data.workOrders.openCount)}
                color={colors.info}
              />
              <SummaryCard
                label="Completion Rate"
                value={
                  data.workOrders.totalCount > 0
                    ? `${Math.round((data.workOrders.completedCount / data.workOrders.totalCount) * 100)}%`
                    : "0%"
                }
              />
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
                WO #
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "10%" }]}>
                Date
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "20%" }]}>
                Customer
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "15%" }]}>
                Site
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "22%" }]}>
                Title
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "10%" }]}>
                Status
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "11%", textAlign: "right" },
                ]}
              >
                Type
              </Text>
            </View>

            {data.workOrders.rows.map((row, i) => (
              <View
                key={i}
                style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
              >
                <Text style={[styles.tableCell, { width: "12%" }]}>
                  {row.workOrderNumber}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "10%" }]}>
                  {formatDate(row.date)}
                </Text>
                <Text style={[styles.tableCell, { width: "20%" }]}>
                  {row.customer}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "15%" }]}>
                  {row.site}
                </Text>
                <Text style={[styles.tableCell, { width: "22%" }]}>
                  {row.title}
                </Text>
                <Text
                  style={[styles.tableCell, { width: "10%", fontSize: 8 }]}
                >
                  {row.status}
                </Text>
                <Text
                  style={[
                    styles.tableCellMuted,
                    { width: "11%", textAlign: "right", fontSize: 8 },
                  ]}
                >
                  {row.orderType}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Materials Report */}
        {data.reportType === "materials" && data.materials && (
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <SummaryCard
                label="Total Cost"
                value={formatCurrency(data.materials.totalCost)}
                color={colors.accent}
              />
              <SummaryCard
                label="Items Used"
                value={String(data.materials.totalItems)}
              />
              <SummaryCard
                label="Avg Cost/Item"
                value={
                  data.materials.totalItems > 0
                    ? formatCurrency(
                        data.materials.totalCost / data.materials.totalItems
                      )
                    : "$0.00"
                }
              />
              <SummaryCard label="Period" value={`${formatDate(data.dateRange.from)} -`} />
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
                Date
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "25%" }]}>
                Material
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "14%" }]}>
                Part #
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "13%" }]}>
                Category
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "8%", textAlign: "right" },
                ]}
              >
                Qty
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "14%", textAlign: "right" },
                ]}
              >
                Unit Cost
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "14%", textAlign: "right" },
                ]}
              >
                Total
              </Text>
            </View>

            {data.materials.rows.map((row, i) => (
              <View
                key={i}
                style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
              >
                <Text style={[styles.tableCellMuted, { width: "12%" }]}>
                  {formatDate(row.date)}
                </Text>
                <Text style={[styles.tableCell, { width: "25%" }]}>
                  {row.name}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "14%" }]}>
                  {row.partNumber}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "13%" }]}>
                  {row.category}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "8%", textAlign: "right" },
                  ]}
                >
                  {row.quantity}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "14%", textAlign: "right" },
                  ]}
                >
                  {formatCurrency(row.unitCost)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      width: "14%",
                      textAlign: "right",
                      fontFamily: "Helvetica-Bold",
                    },
                  ]}
                >
                  {formatCurrency(row.totalCost)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Quotes Report */}
        {data.reportType === "quotes" && data.quotes && (
          <View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <SummaryCard
                label="Total Value"
                value={formatCurrency(data.quotes.totalValue)}
                color={colors.accent}
              />
              <SummaryCard
                label="Approved"
                value={String(data.quotes.approvedCount)}
                color={colors.success}
              />
              <SummaryCard
                label="Pending"
                value={String(data.quotes.pendingCount)}
                color={colors.warning}
              />
              <SummaryCard
                label="Conversion Rate"
                value={`${Math.round(data.quotes.conversionRate)}%`}
              />
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: "13%" }]}>
                Quote
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "10%" }]}>
                Date
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "22%" }]}>
                Customer
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "11%" }]}>
                Status
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "14%", textAlign: "right" },
                ]}
              >
                Total
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
                Sent
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
                Approved
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "6%" }]}>
                Valid
              </Text>
            </View>

            {data.quotes.rows.map((row, i) => (
              <View
                key={i}
                style={i % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
              >
                <Text style={[styles.tableCell, { width: "13%" }]}>
                  {row.quoteNumber}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "10%" }]}>
                  {formatDate(row.date)}
                </Text>
                <Text style={[styles.tableCell, { width: "22%" }]}>
                  {row.customer}
                </Text>
                <Text
                  style={[styles.tableCell, { width: "11%", fontSize: 8 }]}
                >
                  {row.status}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      width: "14%",
                      textAlign: "right",
                      fontFamily: "Helvetica-Bold",
                    },
                  ]}
                >
                  {formatCurrency(row.total)}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "12%" }]}>
                  {formatDate(row.sentDate)}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "12%" }]}>
                  {formatDate(row.approvedDate)}
                </Text>
                <Text style={[styles.tableCellMuted, { width: "6%" }]}>
                  {formatDate(row.validUntil)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.orgName} - {reportTitles[data.reportType]}
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
