/**
 * ai-triggers.ts — Simple trigger functions that API routes call to enqueue AI analysis.
 *
 * Each function wraps enqueueAiAnalysis with the correct triggerEvent, entityType,
 * priority, and payload for its specific use case. Fire-and-forget — callers do not
 * need to await these unless they want to confirm the job was enqueued.
 */

import { enqueueAiAnalysis } from "@/lib/ai/ai-queue";

// ============================================
// WORK ORDER TRIGGERS
// ============================================

/**
 * Trigger AI analysis when a work order is completed.
 *
 * Enqueues a report analysis job (priority 5). If assetId is provided,
 * also enqueues an asset-level analysis at lower priority (9) to look
 * for trends and degradation patterns across the asset's history.
 */
export async function triggerWorkOrderCompleted(
  orgId: string,
  workOrderId: string,
  assetId: string | null
): Promise<void> {
  await enqueueAiAnalysis(orgId, "work_order.completed", "WorkOrder", workOrderId, 5);

  if (assetId !== null) {
    await enqueueAiAnalysis(
      orgId,
      "work_order.completed.asset_analysis",
      "Asset",
      assetId,
      9
    );
  }
}

/**
 * Trigger AI analysis when a new work order is created.
 *
 * Priority 3 — allows the AI to suggest scheduling optimizations,
 * flag related open work orders, or pre-populate checklists.
 */
export async function triggerWorkOrderCreated(
  orgId: string,
  workOrderId: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "work_order.created", "WorkOrder", workOrderId, 3);
}

// ============================================
// MEASUREMENT TRIGGERS
// ============================================

/**
 * Trigger AI analysis when a measurement is recorded on an asset.
 *
 * Passes the measurement name and value as payload so the AI processor
 * can compare against historical baselines and flag anomalies.
 */
export async function triggerMeasurementRecorded(
  orgId: string,
  assetId: string,
  measurement: { name: string; value: number }
): Promise<void> {
  await enqueueAiAnalysis(orgId, "measurement.recorded", "Asset", assetId, 5, measurement);
}

// ============================================
// FINDING TRIGGERS
// ============================================

/**
 * Trigger AI analysis when a finding is created on an asset.
 *
 * Priority 3 (higher urgency) — findings often indicate immediate
 * issues that need correlation with other asset data.
 */
export async function triggerFindingCreated(
  orgId: string,
  assetId: string,
  category: string,
  details: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "finding.created", "Asset", assetId, 3, {
    category,
    details,
  });
}

// ============================================
// QUOTE TRIGGERS
// ============================================

/**
 * Trigger AI analysis when a quote is created.
 *
 * Priority 5 — standard analysis for pricing suggestions,
 * margin calculations, and similar-quote comparisons.
 */
export async function triggerQuoteCreated(
  orgId: string,
  quoteId: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "quote.created", "Quote", quoteId, 5);
}

/**
 * Trigger AI analysis when a quote is sent to the customer.
 *
 * Priority 9 (lowest) — background analysis for tracking conversion
 * metrics and follow-up timing recommendations.
 */
export async function triggerQuoteSent(
  orgId: string,
  quoteId: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "quote.sent", "Quote", quoteId, 9);
}

// ============================================
// PM SCHEDULE TRIGGERS
// ============================================

/**
 * Trigger AI analysis when a PM schedule is executed on an asset.
 *
 * Passes the scheduleId as payload so the AI processor can evaluate
 * PM compliance, adjust recommended intervals, and detect patterns.
 */
export async function triggerPMExecuted(
  orgId: string,
  assetId: string,
  scheduleId: string
): Promise<void> {
  await enqueueAiAnalysis(orgId, "pm_schedule.executed", "Asset", assetId, 5, {
    scheduleId,
  });
}
