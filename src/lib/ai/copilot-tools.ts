/**
 * copilot-tools.ts — Tool definitions and executors for the AI Copilot.
 *
 * Defines 10 database query tools that Claude can call during copilot
 * conversations. Each tool queries Prisma with orgId filtering and returns
 * serialized JSON results capped at a safe token limit.
 *
 * Exports:
 *  - copilotToolDefinitions  — Anthropic tool definitions for messages.create
 *  - executeCopilotTool      — Executes a tool by name, returns JSON string
 */

import { prisma } from "@/lib/prisma";

// ============================================
// TOOL DEFINITIONS (Anthropic format)
// ============================================

export const copilotToolDefinitions: Array<{
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}> = [
  {
    name: "search_assets",
    description:
      "Search for assets (equipment) by name, serial number, or manufacturer. Returns up to 20 matching assets with their basic info, customer, and site.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Text to search for in asset name, serial number, or manufacturer",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_work_orders",
    description:
      "Get work orders, optionally filtered by asset, customer, status, or date range. Returns up to 20 work orders with their basic info.",
    input_schema: {
      type: "object" as const,
      properties: {
        assetId: {
          type: "string",
          description: "Filter by asset ID",
        },
        customerId: {
          type: "string",
          description: "Filter by customer ID",
        },
        status: {
          type: "string",
          description:
            "Filter by status: OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED",
        },
        dateFrom: {
          type: "string",
          description: "Filter work orders created on or after this date (ISO 8601)",
        },
        dateTo: {
          type: "string",
          description: "Filter work orders created on or before this date (ISO 8601)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_measurements",
    description:
      "Get task measurements for a specific asset. Returns up to 50 recent measurements with values, units, and spec compliance.",
    input_schema: {
      type: "object" as const,
      properties: {
        assetId: {
          type: "string",
          description: "Asset ID to get measurements for",
        },
      },
      required: ["assetId"],
    },
  },
  {
    name: "get_findings",
    description:
      "Get task findings (deficiencies, safety issues, recommendations) for a specific asset. Returns up to 20 recent findings.",
    input_schema: {
      type: "object" as const,
      properties: {
        assetId: {
          type: "string",
          description: "Asset ID to get findings for",
        },
      },
      required: ["assetId"],
    },
  },
  {
    name: "get_time_entries",
    description:
      "Get time entries (labor hours) for a specific work order. Returns up to 20 time entries with technician info and duration.",
    input_schema: {
      type: "object" as const,
      properties: {
        workOrderId: {
          type: "string",
          description: "Work order ID to get time entries for",
        },
      },
      required: ["workOrderId"],
    },
  },
  {
    name: "get_pm_schedules",
    description:
      "Get preventive maintenance schedules, optionally filtered by asset. Returns up to 20 PM schedules with frequency and next scheduled date.",
    input_schema: {
      type: "object" as const,
      properties: {
        assetId: {
          type: "string",
          description: "Filter by asset ID",
        },
      },
      required: [],
    },
  },
  {
    name: "get_quotes",
    description:
      "Get quotes, optionally filtered by customer or status. Returns up to 20 quotes with totals and line item counts.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerId: {
          type: "string",
          description: "Filter by customer ID",
        },
        status: {
          type: "string",
          description:
            "Filter by status: DRAFT, SENT, APPROVED, REJECTED, CONVERTED, EXPIRED",
        },
      },
      required: [],
    },
  },
  {
    name: "get_invoices",
    description:
      "Get invoices, optionally filtered by customer or status. Returns up to 20 invoices with totals and payment info.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerId: {
          type: "string",
          description: "Filter by customer ID",
        },
        status: {
          type: "string",
          description:
            "Filter by status: DRAFT, SENT, PAID, OVERDUE, VOID, CREDITED",
        },
      },
      required: [],
    },
  },
  {
    name: "get_ai_insights",
    description:
      "Get AI-generated insights (predictions, anomalies, recommendations), optionally filtered by entity type or entity ID. Returns up to 20 active insights.",
    input_schema: {
      type: "object" as const,
      properties: {
        entityType: {
          type: "string",
          description:
            "Filter by entity type (e.g., 'ASSET', 'WORK_ORDER', 'QUOTE')",
        },
        entityId: {
          type: "string",
          description: "Filter by entity ID",
        },
      },
      required: [],
    },
  },
  {
    name: "get_customer_history",
    description:
      "Get a comprehensive view of a customer including their recent work orders, quotes, and invoices. Useful for understanding the full relationship with a customer.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerId: {
          type: "string",
          description: "Customer ID to look up",
        },
      },
      required: ["customerId"],
    },
  },
];

// ============================================
// TOOL EXECUTORS
// ============================================

/**
 * Execute a copilot tool by name and return serialized JSON result.
 *
 * All queries are scoped to the given orgId for multi-tenant isolation.
 * Results are capped at safe limits to prevent token bloat.
 */
export async function executeCopilotTool(
  toolName: string,
  args: Record<string, unknown>,
  orgId: string
): Promise<string> {
  switch (toolName) {
    case "search_assets":
      return JSON.stringify(await searchAssets(orgId, args));
    case "get_work_orders":
      return JSON.stringify(await getWorkOrders(orgId, args));
    case "get_measurements":
      return JSON.stringify(await getMeasurements(orgId, args));
    case "get_findings":
      return JSON.stringify(await getFindings(orgId, args));
    case "get_time_entries":
      return JSON.stringify(await getTimeEntries(orgId, args));
    case "get_pm_schedules":
      return JSON.stringify(await getPmSchedules(orgId, args));
    case "get_quotes":
      return JSON.stringify(await getQuotes(orgId, args));
    case "get_invoices":
      return JSON.stringify(await getInvoices(orgId, args));
    case "get_ai_insights":
      return JSON.stringify(await getAiInsights(orgId, args));
    case "get_customer_history":
      return JSON.stringify(await getCustomerHistory(orgId, args));
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ============================================
// INPUT VALIDATION HELPERS
// ============================================

/** Parse and validate an ISO 8601 date string. Returns Date or null if invalid. */
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

/** Validate a string value against an allowed set of enum values. Returns the value or null. */
function validateEnum(value: unknown, allowed: string[]): string | null {
  if (!value) return null;
  const s = String(value);
  return allowed.includes(s) ? s : null;
}

const WORK_ORDER_STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];
const QUOTE_STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED", "CONVERTED", "EXPIRED", "CANCELED"];
const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID", "CREDITED", "CANCELED"];

// ============================================
// INDIVIDUAL TOOL IMPLEMENTATIONS
// ============================================

async function searchAssets(
  orgId: string,
  args: Record<string, unknown>
) {
  const query = String(args.query || "");
  if (!query) return { assets: [], message: "No search query provided" };

  const assets = await prisma.asset.findMany({
    where: {
      orgId,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { serialNumber: { contains: query, mode: "insensitive" } },
        { manufacturer: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      manufacturer: true,
      model: true,
      serialNumber: true,
      assetCategory: true,
      assetFamily: true,
      status: true,
      criticality: true,
      customer: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
  });

  return { assets, total: assets.length };
}

async function getWorkOrders(
  orgId: string,
  args: Record<string, unknown>
) {
  const where: Record<string, unknown> = { orgId };

  if (args.assetId) where.assetId = String(args.assetId);
  if (args.customerId) where.customerId = String(args.customerId);

  const status = validateEnum(args.status, WORK_ORDER_STATUSES);
  if (status) where.status = status;

  if (args.dateFrom || args.dateTo) {
    const createdAt: Record<string, Date> = {};
    const from = parseDate(args.dateFrom);
    const to = parseDate(args.dateTo);
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      orderType: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      asset: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
  });

  return { workOrders, total: workOrders.length };
}

async function getMeasurements(
  orgId: string,
  args: Record<string, unknown>
) {
  const assetId = String(args.assetId || "");
  if (!assetId) return { measurements: [], message: "assetId is required" };

  const measurements = await prisma.taskMeasurement.findMany({
    where: {
      orgId,
      taskInstance: { workOrder: { assetId } },
    },
    take: 50,
    orderBy: { capturedAt: "desc" },
    select: {
      id: true,
      name: true,
      numericValue: true,
      textValue: true,
      passFail: true,
      unit: true,
      minValue: true,
      maxValue: true,
      isWithinSpec: true,
      measurementType: true,
      capturedAt: true,
    },
  });

  return { measurements, total: measurements.length };
}

async function getFindings(
  orgId: string,
  args: Record<string, unknown>
) {
  const assetId = String(args.assetId || "");
  if (!assetId) return { findings: [], message: "assetId is required" };

  const findings = await prisma.taskFinding.findMany({
    where: {
      orgId,
      taskInstance: { workOrder: { assetId } },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      category: true,
      details: true,
      priority: true,
      createdAt: true,
    },
  });

  return { findings, total: findings.length };
}

async function getTimeEntries(
  orgId: string,
  args: Record<string, unknown>
) {
  const workOrderId = String(args.workOrderId || "");
  if (!workOrderId) return { timeEntries: [], message: "workOrderId is required" };

  const timeEntries = await prisma.timeEntry.findMany({
    where: { orgId, workOrderId },
    take: 20,
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      startedAt: true,
      stoppedAt: true,
      accumulatedSeconds: true,
      notes: true,
      user: { select: { id: true, name: true } },
    },
  });

  return { timeEntries, total: timeEntries.length };
}

async function getPmSchedules(
  orgId: string,
  args: Record<string, unknown>
) {
  const where: Record<string, unknown> = { orgId };
  if (args.assetId) where.assetId = String(args.assetId);

  const schedules = await prisma.workflowDefinition.findMany({
    where,
    take: 20,
    orderBy: { nextScheduledDate: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      frequencyType: true,
      frequencyValue: true,
      nextScheduledDate: true,
      lastGeneratedDate: true,
      executionCount: true,
      status: true,
      priority: true,
      asset: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  });

  return { schedules, total: schedules.length };
}

async function getQuotes(
  orgId: string,
  args: Record<string, unknown>
) {
  const where: Record<string, unknown> = { orgId };
  if (args.customerId) where.customerId = String(args.customerId);
  const quoteStatus = validateEnum(args.status, QUOTE_STATUSES);
  if (quoteStatus) where.status = quoteStatus;

  const quotes = await prisma.quote.findMany({
    where,
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quoteNumber: true,
      title: true,
      status: true,
      subtotal: true,
      tax: true,
      total: true,
      validUntil: true,
      sentAt: true,
      approvedAt: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      _count: { select: { lineItems: true } },
    },
  });

  return { quotes, total: quotes.length };
}

async function getInvoices(
  orgId: string,
  args: Record<string, unknown>
) {
  const where: Record<string, unknown> = { orgId };
  if (args.customerId) where.customerId = String(args.customerId);
  const invoiceStatus = validateEnum(args.status, INVOICE_STATUSES);
  if (invoiceStatus) where.status = invoiceStatus;

  const invoices = await prisma.invoice.findMany({
    where,
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      title: true,
      status: true,
      subtotal: true,
      tax: true,
      total: true,
      dueDate: true,
      paidAt: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      _count: { select: { lineItems: true } },
    },
  });

  return { invoices, total: invoices.length };
}

async function getAiInsights(
  orgId: string,
  args: Record<string, unknown>
) {
  const where: Record<string, unknown> = { orgId, isActive: true };
  if (args.entityType) where.entityType = String(args.entityType);
  if (args.entityId) where.entityId = String(args.entityId);

  const insights = await prisma.aiInsight.findMany({
    where,
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      insightType: true,
      entityType: true,
      entityId: true,
      severity: true,
      title: true,
      summary: true,
      confidence: true,
      actionRecommended: true,
      acknowledgedAt: true,
      createdAt: true,
    },
  });

  return { insights, total: insights.length };
}

async function getCustomerHistory(
  orgId: string,
  args: Record<string, unknown>
) {
  const customerId = String(args.customerId || "");
  if (!customerId) return { error: "customerId is required" };

  const [customer, workOrders, quotes, invoices] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, orgId },
      select: {
        id: true,
        name: true,
        status: true,
        primaryEmail: true,
        primaryPhone: true,
        billingAddress: true,
        notes: true,
        createdAt: true,
        _count: {
          select: {
            sites: true,
            assets: true,
            workOrders: true,
            quotes: true,
            invoices: true,
          },
        },
      },
    }),
    prisma.workOrder.findMany({
      where: { orgId, customerId },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        status: true,
        priority: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    prisma.quote.findMany({
      where: { orgId, customerId },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        quoteNumber: true,
        title: true,
        status: true,
        total: true,
        createdAt: true,
      },
    }),
    prisma.invoice.findMany({
      where: { orgId, customerId },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        title: true,
        status: true,
        total: true,
        paidAt: true,
        createdAt: true,
      },
    }),
  ]);

  if (!customer) return { error: "Customer not found" };

  return {
    customer,
    recentWorkOrders: workOrders,
    recentQuotes: quotes,
    recentInvoices: invoices,
  };
}
