import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  styles,
  colors,
  formatDate,
  getStatusColor,
} from "./shared-styles";

export interface WOTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sequenceNumber: number | null;
  isCritical: boolean;
  assignedTo: { name: string | null } | null;
}

export interface WOPackage {
  id: string;
  packageType: string;
  tasks: WOTask[];
}

export interface WorkOrderData {
  workOrderNumber: string | null;
  title: string;
  description: string | null;
  status: string;
  executionMode: string;
  orderType: string;
  priority: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  createdAt: string;
  customer: {
    name: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
  } | null;
  site: {
    name: string;
    address: string | null;
  } | null;
  asset: {
    name: string;
    serialNumber: string | null;
    assetTag: string | null;
  } | null;
  packages: WOPackage[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalLaborHours: number;
    totalMaterialCost: number;
  };
  orgName: string;
}

const priorityLabels: Record<number, string> = {
  1: "Low",
  2: "Normal",
  3: "High",
  4: "Urgent",
};

export function WorkOrderReportDocument({ data }: { data: WorkOrderData }) {
  const woNumber =
    data.workOrderNumber || `WO-${Date.now().toString(36).toUpperCase()}`;
  const allTasks = data.packages
    .flatMap((pkg) => pkg.tasks)
    .sort((a, b) => (a.sequenceNumber || 999) - (b.sequenceNumber || 999));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{data.orgName}</Text>
            <Text style={styles.documentLabel}>WORK ORDER</Text>
          </View>
          <View>
            <Text style={styles.documentNumber}>{woNumber}</Text>
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(data.status) },
              ]}
            >
              {data.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Title */}
        <Text style={styles.title}>{data.title}</Text>
        <Text style={[styles.label, { marginBottom: 12 }]}>
          {data.orderType.replace("_", " ")} |{" "}
          {data.executionMode === "UNIFIED" ? "Unified" : "Multi-Lane"}
        </Text>

        {/* Customer & Site */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Customer & Location</Text>
            {data.customer && (
              <View>
                <Text style={styles.valueBold}>{data.customer.name}</Text>
                {data.customer.primaryPhone && (
                  <Text style={styles.value}>{data.customer.primaryPhone}</Text>
                )}
                {data.customer.primaryEmail && (
                  <Text style={styles.value}>{data.customer.primaryEmail}</Text>
                )}
              </View>
            )}
            {data.site && (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.label}>Site:</Text>
                <Text style={styles.value}>{data.site.name}</Text>
                {data.site.address && (
                  <Text style={[styles.value, { fontSize: 9 }]}>
                    {data.site.address}
                  </Text>
                )}
              </View>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Schedule & Details</Text>
            <View style={{ flexDirection: "row", marginBottom: 3 }}>
              <Text style={[styles.label, { width: 70 }]}>Created:</Text>
              <Text style={styles.value}>{formatDate(data.createdAt)}</Text>
            </View>
            {data.priority && (
              <View style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={[styles.label, { width: 70 }]}>Priority:</Text>
                <Text
                  style={[
                    styles.value,
                    data.priority >= 3 ? { color: colors.danger } : {},
                  ]}
                >
                  {priorityLabels[data.priority] || "Normal"}
                </Text>
              </View>
            )}
            {data.scheduledStart && (
              <View style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={[styles.label, { width: 70 }]}>Scheduled:</Text>
                <Text style={styles.value}>
                  {formatDate(data.scheduledStart)}
                </Text>
              </View>
            )}
            {data.asset && (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.label}>Asset:</Text>
                <Text style={styles.value}>{data.asset.name}</Text>
                {(data.asset.serialNumber || data.asset.assetTag) && (
                  <Text style={[styles.value, { fontSize: 8 }]}>
                    {[
                      data.asset.serialNumber
                        ? `S/N: ${data.asset.serialNumber}`
                        : null,
                      data.asset.assetTag
                        ? `Tag: ${data.asset.assetTag}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" | ")}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {data.description && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{data.description}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Task Checklist */}
        <Text style={styles.sectionTitle}>
          Tasks ({data.summary.completedTasks}/{data.summary.totalTasks}{" "}
          completed)
        </Text>

        {allTasks.length === 0 ? (
          <Text style={[styles.value, { color: colors.muted }]}>
            No tasks assigned
          </Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: "6%" }]}>#</Text>
              <Text style={[styles.tableHeaderCell, { width: "46%" }]}>
                Task
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "24%" }]}>
                Assigned To
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { width: "24%", textAlign: "right" },
                ]}
              >
                Status
              </Text>
            </View>

            {allTasks.map((task, index) => (
              <View
                key={task.id}
                style={index % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
              >
                <Text style={[styles.tableCellMuted, { width: "6%" }]}>
                  {task.sequenceNumber || "-"}
                </Text>
                <View style={{ width: "46%" }}>
                  <Text style={styles.tableCell}>
                    {task.isCritical ? "[!] " : ""}
                    {task.title}
                  </Text>
                </View>
                <Text style={[styles.tableCellMuted, { width: "24%" }]}>
                  {task.assignedTo?.name || "-"}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      width: "24%",
                      textAlign: "right",
                      color: getStatusColor(task.status),
                      fontFamily: "Helvetica-Bold",
                      fontSize: 8,
                    },
                  ]}
                >
                  {task.status.replace("_", " ")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Summary Box */}
        <View style={{ marginTop: 20 }}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.background,
              padding: 16,
              borderRadius: 4,
            }}
          >
            <View style={{ width: "25%", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.text }}>
                {Math.round(data.summary.completionRate)}%
              </Text>
              <Text style={{ fontSize: 8, color: colors.muted, marginTop: 2 }}>
                Completion
              </Text>
              <Text style={{ fontSize: 7, color: colors.light, marginTop: 1 }}>
                {data.summary.completedTasks}/{data.summary.totalTasks} tasks
              </Text>
            </View>
            <View style={{ width: "25%", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.text }}>
                {data.summary.totalLaborHours}h
              </Text>
              <Text style={{ fontSize: 8, color: colors.muted, marginTop: 2 }}>
                Labor Hours
              </Text>
            </View>
            <View style={{ width: "25%", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.text }}>
                ${data.summary.totalMaterialCost.toFixed(2)}
              </Text>
              <Text style={{ fontSize: 8, color: colors.muted, marginTop: 2 }}>
                Material Cost
              </Text>
            </View>
            <View style={{ width: "25%", alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Helvetica-Bold",
                  color: getStatusColor(data.status),
                }}
              >
                {data.status.replace("_", " ")}
              </Text>
              <Text style={{ fontSize: 8, color: colors.muted, marginTop: 2 }}>
                Status
              </Text>
            </View>
          </View>
        </View>

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Technician Signature</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              Customer Acknowledgment / Date
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.orgName} - {woNumber}
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
