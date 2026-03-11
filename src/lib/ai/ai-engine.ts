/**
 * ai-engine.ts — AI pipeline processor for ServiceOpsIQ.
 *
 * Builds rich context from Prisma data, calls Claude for analysis,
 * stores resulting AiInsight records, and notifies admins on high-severity findings.
 *
 * Context builders run parallel Prisma queries to minimize latency.
 * The pipeline processor orchestrates: context → Claude → persist → notify.
 */

import { prisma } from "@/lib/prisma";
import { Prisma, AiInsightJob } from "@prisma/client";
import { getAnthropicClient } from "./anthropic";
import {
  AI_INSIGHT_MODEL,
  AI_INSIGHT_MAX_TOKENS,
  getSystemPromptForEvent,
} from "./ai-prompts";
import { completeAiJob, failAiJob } from "./ai-queue";
import { notifyMultipleUsers } from "@/lib/notifications";

// ============================================
// TYPES
// ============================================

export interface AssetContext {
  asset: Record<string, unknown> | null;
  workHistory: Record<string, unknown>[];
  measurements: Record<string, unknown>[];
  findings: Record<string, unknown>[];
  pmSchedules: Record<string, unknown>[];
}

export interface WorkOrderContext {
  workOrder: Record<string, unknown> | null;
  taskInstances: Record<string, unknown>[];
  materialsUsed: Record<string, unknown>[];
  timeEntries: Record<string, unknown>[];
}

export interface SchedulingContext {
  workOrder: Record<string, unknown> | null;
  availableTechs: Record<string, unknown>[];
  activeWorkOrders: Record<string, unknown>[];
}

export interface QuoteContext {
  quote: Record<string, unknown> | null;
  historicalQuotes: Record<string, unknown>[];
}

export interface ProcessResult {
  insightsCreated: number;
  tokensUsed: number;
}

// ============================================
// CONTEXT BUILDERS
// ============================================

/**
 * Build context for asset-centric analysis (predictive maintenance, anomalies).
 * Parallel-fetches asset info, work history, measurements, findings, and PM schedules.
 */
export async function buildAssetContext(
  orgId: string,
  assetId: string
): Promise<AssetContext> {
  const [asset, workHistory, measurements, findings, pmSchedules] =
    await Promise.all([
      // Asset with basic fields
      prisma.asset.findFirst({
        where: { id: assetId, orgId },
        select: {
          id: true,
          name: true,
          manufacturer: true,
          model: true,
          serialNumber: true,
          assetCategory: true,
          assetFamily: true,
          assetSubFamily: true,
          criticality: true,
          nameplate: true,
        },
      }),

      // Last 20 work orders for this asset
      prisma.workOrder.findMany({
        where: { assetId, orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          completedAt: true,
          createdAt: true,
        },
      }),

      // Last 50 TaskMeasurements linked via taskInstance.workOrder.assetId
      prisma.taskMeasurement.findMany({
        where: {
          orgId,
          taskInstance: { workOrder: { assetId } },
        },
        orderBy: { capturedAt: "desc" },
        take: 50,
        select: {
          name: true,
          numericValue: true,
          unit: true,
          minValue: true,
          maxValue: true,
          isWithinSpec: true,
          capturedAt: true,
        },
      }),

      // Last 20 TaskFindings linked via taskInstance.workOrder.assetId
      prisma.taskFinding.findMany({
        where: {
          orgId,
          taskInstance: { workOrder: { assetId } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          category: true,
          details: true,
          priority: true,
          createdAt: true,
        },
      }),

      // WorkflowDefinitions for this asset (PM schedules)
      prisma.workflowDefinition.findMany({
        where: { assetId, orgId },
        select: {
          name: true,
          frequencyType: true,
          frequencyValue: true,
          nextScheduledDate: true,
          executionCount: true,
        },
      }),
    ]);

  return {
    asset: asset as Record<string, unknown> | null,
    workHistory: workHistory as unknown as Record<string, unknown>[],
    measurements: measurements as unknown as Record<string, unknown>[],
    findings: findings as unknown as Record<string, unknown>[],
    pmSchedules: pmSchedules as unknown as Record<string, unknown>[],
  };
}

/**
 * Build context for work-order-centric analysis (report generation, completed WO).
 * Parallel-fetches WO with relations, task instances, materials, and time entries.
 */
export async function buildWorkOrderContext(
  orgId: string,
  workOrderId: string
): Promise<WorkOrderContext> {
  const [workOrder, taskInstances, materialsUsed, timeEntries] =
    await Promise.all([
      // Work order with asset, customer, site
      prisma.workOrder.findFirst({
        where: { id: workOrderId, orgId },
        include: { asset: true, customer: true, site: true },
      }),

      // Task instances with measurements and findings
      prisma.taskInstance.findMany({
        where: { workOrderId, orgId },
        include: { measurements: true, findings: true },
      }),

      // Materials used via task instances
      prisma.taskMaterialUsage.findMany({
        where: { taskInstance: { workOrderId }, orgId },
      }),

      // Time entries for this WO
      prisma.timeEntry.findMany({
        where: { workOrderId, orgId },
        select: {
          userId: true,
          accumulatedSeconds: true,
          status: true,
        },
      }),
    ]);

  return {
    workOrder: workOrder as unknown as Record<string, unknown> | null,
    taskInstances: taskInstances as unknown as Record<string, unknown>[],
    materialsUsed: materialsUsed as unknown as Record<string, unknown>[],
    timeEntries: timeEntries as unknown as Record<string, unknown>[],
  };
}

/**
 * Build context for scheduling analysis (technician assignment on new WO).
 * Parallel-fetches WO details, available techs (raw query), and active WOs.
 */
export async function buildSchedulingContext(
  orgId: string,
  workOrderId: string
): Promise<SchedulingContext> {
  const [workOrder, availableTechs, activeWorkOrders] = await Promise.all([
    // Work order with asset and site
    prisma.workOrder.findFirst({
      where: { id: workOrderId, orgId },
      include: { asset: true, site: true },
    }),

    // Techs in this org via raw query (user_org_roles join table)
    prisma.$queryRaw<{ id: string; fullName: string; email: string }[]>(
      Prisma.sql`
        SELECT u.id, u."fullName", u.email
        FROM "User" u
        JOIN user_org_roles uor ON u.id::text = uor.user_id::text
        WHERE uor.org_id = ${orgId}
          AND uor.role = 'TECH'
      `
    ),

    // Active/open work orders with task assignments for workload context
    prisma.workOrder.findMany({
      where: {
        orgId,
        status: { in: ["OPEN", "IN_PROGRESS", "SCHEDULED"] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        scheduledStartDate: true,
        assignedToUserId: true,
      },
    }),
  ]);

  return {
    workOrder: workOrder as unknown as Record<string, unknown> | null,
    availableTechs: availableTechs as unknown as Record<string, unknown>[],
    activeWorkOrders: activeWorkOrders as unknown as Record<string, unknown>[],
  };
}

/**
 * Build context for quote analysis (intelligent quoting suggestions).
 * Parallel-fetches the quote with relations and historical approved/rejected quotes.
 */
export async function buildQuoteContext(
  orgId: string,
  quoteId: string
): Promise<QuoteContext> {
  const [quote, historicalQuotes] = await Promise.all([
    // Quote with line items, customer, asset
    prisma.quote.findFirst({
      where: { id: quoteId, orgId },
      include: { lineItems: true, customer: true, asset: true },
    }),

    // Last 20 historical quotes (approved/rejected/converted) with line items
    prisma.quote.findMany({
      where: {
        orgId,
        status: { in: ["APPROVED", "REJECTED", "CONVERTED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { lineItems: true },
    }),
  ]);

  return {
    quote: quote as unknown as Record<string, unknown> | null,
    historicalQuotes: historicalQuotes as unknown as Record<string, unknown>[],
  };
}

// ============================================
// PIPELINE PROCESSOR
// ============================================

/**
 * Process a single AI insight job end-to-end:
 * 1. Build context based on trigger event
 * 2. Upsert AiAnalysisContext snapshot
 * 3. Call Claude with system prompt + context
 * 4. Parse response and create AiInsight records
 * 5. Notify admins on HIGH/CRITICAL severity
 * 6. Mark job complete
 */
export async function processAiJob(
  job: AiInsightJob
): Promise<ProcessResult> {
  const startTime = Date.now();

  try {
    // 1. Build context based on trigger event prefix
    let context: Record<string, unknown>;

    if (job.triggerEvent.startsWith("work_order.completed")) {
      context = await buildWorkOrderContext(job.orgId, job.entityId);
    } else if (job.triggerEvent.startsWith("work_order.created")) {
      context = await buildSchedulingContext(job.orgId, job.entityId);
    } else if (job.triggerEvent.startsWith("quote.")) {
      context = await buildQuoteContext(job.orgId, job.entityId);
    } else {
      // Default: asset-level predictive maintenance
      context = await buildAssetContext(job.orgId, job.entityId);
    }

    // 2. Upsert AiAnalysisContext with snapshot
    await prisma.aiAnalysisContext.upsert({
      where: {
        orgId_entityType_entityId: {
          orgId: job.orgId,
          entityType: job.entityType,
          entityId: job.entityId,
        },
      },
      create: {
        orgId: job.orgId,
        entityType: job.entityType,
        entityId: job.entityId,
        contextSnapshot: context as unknown as Prisma.InputJsonValue,
        lastAnalyzedAt: new Date(),
      },
      update: {
        contextSnapshot: context as unknown as Prisma.InputJsonValue,
        lastAnalyzedAt: new Date(),
      },
    });

    // 3. Call Claude
    const systemPrompt = getSystemPromptForEvent(job.triggerEvent);
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: AI_INSIGHT_MODEL,
      max_tokens: AI_INSIGHT_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze the following service data and return structured insights.\n\nContext:\n${JSON.stringify(context, null, 2)}`,
        },
      ],
    });

    const durationMs = Date.now() - startTime;
    const tokensUsed =
      response.usage.input_tokens + response.usage.output_tokens;

    // 4. Parse JSON response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude API");
    }

    let cleaned = textContent.text.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    const insights: Array<Record<string, unknown>> = parsed.insights || [];

    // 5. Create AiInsight records
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const createdInsights = await Promise.all(
      insights.map((insight) =>
        prisma.aiInsight.create({
          data: {
            orgId: job.orgId,
            insightType: insight.type as string,
            entityType: job.entityType,
            entityId: job.entityId,
            severity: (insight.severity as string) || "MEDIUM",
            title: (insight.title as string) || "AI Insight",
            summary: (insight.summary as string) || "",
            details: insight.details
              ? (insight as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            confidence:
              typeof insight.confidence === "number"
                ? insight.confidence
                : 0.5,
            actionRecommended:
              (insight.actionRecommended as string) || null,
            llmModel: AI_INSIGHT_MODEL,
            tokensUsed,
            durationMs,
            expiresAt,
          },
        })
      )
    );

    // 6. Notify admins on HIGH/CRITICAL severity insights
    const highSeverityInsights = createdInsights.filter(
      (i) => i.severity === "HIGH" || i.severity === "CRITICAL"
    );

    if (highSeverityInsights.length > 0) {
      const adminRows = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT u.id
          FROM "User" u
          JOIN user_org_roles uor ON u.id::text = uor.user_id::text
          WHERE uor.org_id = ${job.orgId}
            AND uor.role = 'ADMIN'
        `
      );

      const adminIds = adminRows.map((r) => r.id);

      if (adminIds.length > 0) {
        for (const insight of highSeverityInsights) {
          await notifyMultipleUsers(
            adminIds,
            job.orgId,
            "WORK_ORDER_STATUS_CHANGED",
            `AI Insight: ${insight.title}`,
            insight.summary,
            undefined,
            {
              insightId: insight.id,
              severity: insight.severity,
              insightType: insight.insightType,
            }
          );
        }
      }
    }

    // 7. Mark job complete
    await completeAiJob(job.id, {
      insightsCreated: createdInsights.length,
      tokensUsed,
      durationMs,
    });

    return { insightsCreated: createdInsights.length, tokensUsed };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await failAiJob(job.id, errorMessage);
    throw error;
  }
}
