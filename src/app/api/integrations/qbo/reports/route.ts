import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runReport } from "@/lib/qbo/qbo-client";
import type { QboReportRow } from "@/lib/qbo/qbo-types";

export const dynamic = "force-dynamic";

// ─── Report Normalization Helpers ──────────────────────────────

type NormalizedSection = {
  name: string;
  total: number;
  items: Array<{ name: string; value: number }>;
};

type NormalizedReport = {
  reportName: string;
  startDate: string;
  endDate: string;
  currency?: string;
  reportBasis?: string;
  sections: NormalizedSection[];
  grandTotal?: number;
};

type AgingBucket = {
  customerName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91plus: number;
  total: number;
};

type NormalizedAgingReport = {
  reportName: string;
  startDate: string;
  endDate: string;
  buckets: AgingBucket[];
  totals: AgingBucket;
};

function extractSections(rows: QboReportRow[]): NormalizedSection[] {
  const sections: NormalizedSection[] = [];

  for (const row of rows) {
    if (row.type === "Section" && row.Header?.ColData?.[0]?.value) {
      const sectionName = row.Header.ColData[0].value;
      const items: Array<{ name: string; value: number }> = [];

      if (row.Rows?.Row) {
        for (const subRow of row.Rows.Row) {
          if (subRow.type === "Data" && subRow.ColData && subRow.ColData.length >= 2) {
            const name = subRow.ColData[0].value;
            const value = parseFloat(subRow.ColData[subRow.ColData.length - 1].value) || 0;
            if (name && name !== "") {
              items.push({ name, value });
            }
          } else if (subRow.type === "Section") {
            // Nested section — flatten into items
            const nested = extractSections([subRow]);
            for (const ns of nested) {
              items.push(...ns.items);
            }
          }
        }
      }

      const total = row.Summary?.ColData
        ? parseFloat(row.Summary.ColData[row.Summary.ColData.length - 1].value) || 0
        : items.reduce((sum, i) => sum + i.value, 0);

      sections.push({ name: sectionName, total, items });
    }
  }

  return sections;
}

function normalizeStandardReport(reportData: Awaited<ReturnType<typeof runReport>>): NormalizedReport {
  const sections = extractSections(reportData.Rows?.Row || []);

  // Find grand total
  const grandTotalRow = (reportData.Rows?.Row || []).find((r) => r.type === "GrandTotal");
  const grandTotal = grandTotalRow?.ColData
    ? parseFloat(grandTotalRow.ColData[grandTotalRow.ColData.length - 1].value) || undefined
    : undefined;

  return {
    reportName: reportData.Header?.ReportName || "Unknown",
    startDate: reportData.Header?.StartPeriod || "",
    endDate: reportData.Header?.EndPeriod || "",
    currency: reportData.Header?.Currency,
    reportBasis: reportData.Header?.ReportBasis,
    sections,
    grandTotal,
  };
}

function normalizeAgingReport(reportData: Awaited<ReturnType<typeof runReport>>): NormalizedAgingReport {
  const buckets: AgingBucket[] = [];
  const rows = reportData.Rows?.Row || [];

  for (const row of rows) {
    if (row.type === "Section" && row.Rows?.Row) {
      const customerName = row.Header?.ColData?.[0]?.value || "Unknown";

      // Summary row has the bucket values
      if (row.Summary?.ColData) {
        const cols = row.Summary.ColData.map((c) => parseFloat(c.value) || 0);
        // QBO aging columns: Current, 1-30, 31-60, 61-90, 91+, Total
        buckets.push({
          customerName,
          current: cols[1] || 0,
          days1to30: cols[2] || 0,
          days31to60: cols[3] || 0,
          days61to90: cols[4] || 0,
          days91plus: cols[5] || 0,
          total: cols[cols.length - 1] || 0,
        });
      }
    }
  }

  // Calculate totals
  const totals: AgingBucket = {
    customerName: "Total",
    current: buckets.reduce((s, b) => s + b.current, 0),
    days1to30: buckets.reduce((s, b) => s + b.days1to30, 0),
    days31to60: buckets.reduce((s, b) => s + b.days31to60, 0),
    days61to90: buckets.reduce((s, b) => s + b.days61to90, 0),
    days91plus: buckets.reduce((s, b) => s + b.days91plus, 0),
    total: buckets.reduce((s, b) => s + b.total, 0),
  };

  return {
    reportName: reportData.Header?.ReportName || "AgedReceivableDetail",
    startDate: reportData.Header?.StartPeriod || "",
    endDate: reportData.Header?.EndPeriod || "",
    buckets,
    totals,
  };
}

// ─── Route Handler ─────────────────────────────────────────────

const ALLOWED_REPORTS = ["ProfitAndLoss", "AgedReceivableDetail", "BalanceSheet"];

export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) {
    return authResult.error;
  }
  const { auth } = authResult;

  const { searchParams } = new URL(req.url);
  const report = searchParams.get("report");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const accountingMethod = searchParams.get("accounting_method") || "Accrual";
  const classFilter = searchParams.get("class");
  const departmentFilter = searchParams.get("department");

  if (!report || !ALLOWED_REPORTS.includes(report)) {
    return NextResponse.json(
      { error: `Invalid report. Allowed: ${ALLOWED_REPORTS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "start_date and end_date are required" },
      { status: 400 }
    );
  }

  try {
    const connection = await prisma.qboConnection.findFirst({
      where: { orgId: auth.orgId, isActive: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "No active QBO connection" },
        { status: 404 }
      );
    }

    // Build QBO report params
    const params: Record<string, string> = {
      start_date: startDate,
      end_date: endDate,
      accounting_method: accountingMethod,
    };

    // Add optional filters
    if (classFilter) params.class = classFilter;
    if (departmentFilter) params.department = departmentFilter;

    // Fetch report from QBO
    const reportData = await runReport(connection, report, params);

    // Normalize based on report type
    if (report === "AgedReceivableDetail") {
      const normalized = normalizeAgingReport(reportData);
      return NextResponse.json({ data: normalized });
    } else {
      const normalized = normalizeStandardReport(reportData);
      return NextResponse.json({ data: normalized });
    }
  } catch (err) {
    console.error(`[QBO Reports] Failed to fetch ${report}:`, err);
    return NextResponse.json(
      { error: "Failed to fetch report from QBO", details: String(err) },
      { status: 500 }
    );
  }
}
