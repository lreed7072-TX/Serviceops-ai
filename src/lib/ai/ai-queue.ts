/**
 * ai-queue.ts — Durable queue for AI insight jobs backed by AiInsightJob Prisma model.
 *
 * Provides enqueue/claim/complete/fail operations for all AI analysis jobs.
 * Uses atomic PostgreSQL operations for concurrent safety in serverless.
 * Mirrors the pattern established in qbo-queue.ts.
 */

import { prisma } from "@/lib/prisma";
import { Prisma, AiInsightJob } from "@prisma/client";

// ============================================
// CONSTANTS
// ============================================

/** Seconds before a claimed job's lock is considered stale and reclaimable */
export const AI_STALE_LOCK_SECONDS = 120;

/** Default max retry attempts before a job moves to dead_letter */
export const AI_DEFAULT_MAX_ATTEMPTS = 3;

/** Default number of jobs to claim per batch */
export const AI_DEFAULT_BATCH_SIZE = 20;

// ============================================
// HELPERS
// ============================================

/**
 * Generate a unique locker identifier for this serverless instance.
 * Combines Vercel region, timestamp, and random suffix for traceability.
 */
function generateLockerId(): string {
  const region = process.env.VERCEL_REGION ?? "local";
  const random = Math.random().toString(36).slice(2, 8);
  return `${region}-${Date.now()}-${random}`;
}

// ============================================
// QUEUE OPERATIONS
// ============================================

/**
 * Enqueue a new AI analysis job.
 *
 * Creates an AiInsightJob with status="pending" ready to be claimed by the
 * next queue flush cycle.
 */
export async function enqueueAiAnalysis(
  orgId: string,
  triggerEvent: string,
  entityType: string,
  entityId: string,
  priority: number = 5,
  payload?: Record<string, unknown>
): Promise<AiInsightJob> {
  return prisma.aiInsightJob.create({
    data: {
      orgId,
      triggerEvent,
      entityType,
      entityId,
      priority,
      status: "pending",
      payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
      attempts: 0,
      maxAttempts: AI_DEFAULT_MAX_ATTEMPTS,
    },
  });
}

/**
 * Atomically claim a batch of pending AI jobs for processing.
 *
 * Uses PostgreSQL's UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)
 * pattern for true atomic batch claiming. No two concurrent callers can claim
 * the same job. Jobs are claimed in priority order (1 first), then FIFO.
 */
export async function claimAiBatch(
  limit: number = AI_DEFAULT_BATCH_SIZE
): Promise<AiInsightJob[]> {
  const lockerId = generateLockerId();
  const now = new Date();

  const claimed = await prisma.$queryRaw<AiInsightJob[]>(
    Prisma.sql`
      UPDATE "AiInsightJob"
      SET
        status = 'claimed',
        "lockedAt" = ${now},
        "lockedBy" = ${lockerId},
        "claimedAt" = ${now},
        "updatedAt" = ${now}
      WHERE id IN (
        SELECT id FROM "AiInsightJob"
        WHERE status = 'pending'
        ORDER BY priority ASC, "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `
  );

  return claimed;
}

/**
 * Mark an AI job as completed.
 *
 * Sets status to "completed", records completion timestamp, stores result JSON,
 * and clears the lock.
 */
export async function completeAiJob(
  jobId: string,
  result?: Record<string, unknown>
): Promise<void> {
  await prisma.aiInsightJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      ...(result
        ? { result: result as Prisma.InputJsonValue }
        : {}),
    },
  });
}

/**
 * Mark an AI job as failed.
 *
 * Increments the attempt counter. If attempts >= maxAttempts, promotes the
 * job to "dead_letter" status (permanently failed, requires manual intervention).
 * Otherwise, resets to "pending" for automatic retry on the next flush cycle.
 */
export async function failAiJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const job = await prisma.aiInsightJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  const newAttempts = job.attempts + 1;
  const isDead = newAttempts >= job.maxAttempts;

  await prisma.aiInsightJob.update({
    where: { id: jobId },
    data: {
      status: isDead ? "dead_letter" : "pending",
      attempts: newAttempts,
      lockedAt: null,
      lockedBy: null,
      errorMessage,
      ...(isDead ? { failedAt: new Date() } : {}),
    },
  });
}

/**
 * Reset stale locks on AI jobs that have been claimed but not completed.
 *
 * A lock is considered stale if `lockedAt` is older than `maxAgeSeconds`.
 * Should be called at the start of every queue flush cron invocation.
 */
export async function resetStaleAiLocks(
  maxAgeSeconds: number = AI_STALE_LOCK_SECONDS
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);

  const result = await prisma.aiInsightJob.updateMany({
    where: {
      status: "claimed",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "pending",
      lockedAt: null,
      lockedBy: null,
    },
  });

  return result.count;
}

/**
 * Get queue statistics for an organization.
 *
 * Returns counts grouped by job status (pending, claimed, completed, dead_letter).
 */
export async function getAiQueueStats(
  orgId: string
): Promise<Record<string, number>> {
  const groups = await prisma.aiInsightJob.groupBy({
    by: ["status"],
    where: { orgId },
    _count: { status: true },
  });

  const stats: Record<string, number> = {};
  for (const g of groups) {
    stats[g.status] = g._count.status;
  }
  return stats;
}
