import { StyleSheet } from "@react-pdf/renderer";

// Brand colors
export const colors = {
  primary: "#1f2937",
  accent: "#f97316",
  text: "#111827",
  muted: "#6b7280",
  light: "#9ca3af",
  border: "#e5e7eb",
  background: "#f9fafb",
  white: "#ffffff",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 50,
    paddingBottom: 70,
    color: colors.text,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  companyName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  documentLabel: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4,
  },
  documentNumber: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: colors.text,
    textAlign: "right",
  },

  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: 12,
  },
  dividerThick: {
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    marginVertical: 8,
  },

  // Two column layout
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  col: {
    width: "48%",
  },

  // Section headers
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Text
  label: {
    fontSize: 9,
    color: colors.muted,
  },
  value: {
    fontSize: 10,
    color: colors.text,
    marginBottom: 3,
  },
  valueBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.text,
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.text,
    marginBottom: 6,
  },
  description: {
    fontSize: 10,
    color: colors.muted,
    lineHeight: 1.4,
    marginBottom: 10,
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    fontSize: 9,
    color: colors.text,
  },
  tableCellMuted: {
    fontSize: 9,
    color: colors.muted,
  },

  // Totals
  totalsContainer: {
    alignItems: "flex-end",
    marginTop: 16,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 200,
    marginBottom: 4,
  },
  totalsLabel: {
    fontSize: 10,
    color: colors.muted,
    width: 100,
    textAlign: "right",
    marginRight: 12,
  },
  totalsValue: {
    fontSize: 10,
    color: colors.text,
    width: 80,
    textAlign: "right",
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 200,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  totalsFinalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.text,
    width: 100,
    textAlign: "right",
    marginRight: 12,
  },
  totalsFinalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    width: 80,
    textAlign: "right",
  },

  // Status badge as text
  statusText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },

  // Notes / Terms sections
  notesSection: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: colors.text,
    lineHeight: 1.4,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: colors.light,
  },

  // Signature
  signatureSection: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: {
    width: "45%",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    marginTop: 40,
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: 8,
    color: colors.muted,
  },
});

export function formatCurrency(value: number | string): string {
  return "$" + Number(value).toFixed(2);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: colors.muted,
    SENT: colors.info,
    PAID: colors.success,
    OVERDUE: colors.danger,
    CANCELED: colors.light,
    OPEN: colors.info,
    IN_PROGRESS: colors.warning,
    COMPLETED: colors.success,
    APPROVED: colors.success,
    REJECTED: colors.danger,
    EXPIRED: colors.light,
    CONVERTED: "#8b5cf6",
    PENDING: colors.muted,
    DONE: colors.success,
    BLOCKED: colors.danger,
    SKIPPED: colors.light,
  };
  return map[status] || colors.muted;
}
