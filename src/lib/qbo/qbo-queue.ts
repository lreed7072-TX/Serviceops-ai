/**
 * qbo-queue.ts — Durable sync job queue backed by QboSyncJob Prisma model.
 *
 * Provides enqueue/claim/complete/fail operations for all QBO sync jobs.
 * Uses atomic PostgreSQL operations for concurrent safety in serverless.
 */

import { prisma } from "@/lib/prisma";
import { Prisma, QboSyncJob } from "@prisma/client";

// ============================================
// CONSTANTS
// ============================================

/** Seconds before a claimed job's lock is considered stale and reclaimable */
export const STALE_LOCK_SECONDS = 120;

/** Default max retry attempts before a job moves to dead_letter */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Default number of jobs to claim per batch */
export const DEFAULT_BATCH_SIZE = 30;

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
 * Enqueue a new sync job.
 *
 * Creates a QboSyncJob with status="pending" ready to be claimed by the
 * next queue flush cycle.
 */
export async function enqueue(
  orgId: string,
  connectionId: string,
  entityType: string,
  entityId: string,
  action: string,
  priority: number = 5,
  payload?: Record<string, unknown>
): Promise<QboSyncJob> {
  return prisma.qboSyncJob.create({
    data: {
      orgId,
      connectionId,
      entityType,
      entityId,
      action,
      priority,
      status: "pending",
      payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    },
  });
}

/**
 * Atomically claim a batch of pending jobs for processing.
 *
 * Uses PostgreSQL's UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)
 * pattern for true atomic batch claiming. No two concurrent callers can claim
 * the same job. Jobs are claimed in priority order (1 first), then FIFO.
 */
export async function claimBatch(
  limit: number = DEFAULT_BATCH_SIZE
): Promise<QboSyncJob[]> {
  const lockerId = generateLockerId();
  const now = new Date();

  const claimed = await prisma.$queryRaw<QboSyncJob[]>(
    Prisma.sql`
      UPDATE "QboSyncJob"
      SET
        status = 'claimed',
        "lockedAt" = ${now},
        "lockedBy" = ${lockerId},
        "updatedAt" = ${now}
      WHERE id IN (
        SELECT id FROM "QboSyncJob"
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
 * Mark a job as completed.
 *
 * Sets status to "completed", records completion timestamp, and clears the lock.
 */
export async function complete(
  jobId: string,
  qboEntityId?: string
): Promise<void> {
  await prisma.qboSyncJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      ...(qboEntityId
        ? { payload: { qboEntityId } }
        : {}),
    },
  });
}

/**
 * Mark a job as failed.
 *
 * Increments the attempt counter. If attempts >= maxAttempts, promotes the
 * job to "dead_letter" status (permanently failed, requires manual intervention).
 * Otherwise, resets to "pending" for automatic retry on the next flush cycle.
 */
export async function fail(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const job = await prisma.qboSyncJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  const newAttempts = job.attempts + 1;
  const isDead = newAttempts >= job.maxAttempts;

  await prisma.qboSyncJob.update({
    where: { id: jobId },
    data: {
      status: isDead ? "dead_letter" : "pending",
      attempts: newAttempts,
      lockedAt: null,
      lockedBy: null,
      errorMessage,
    },
  });
}

/**
 * Reset stale locks on jobs that have been claimed but not completed.
 *
 * A lock is considered stale if `lockedAt` is older than `maxAgeSeconds`.
 * Should be called at the start of every queue flush cron invocation.
 */
export async function resetStaleLocks(
  maxAgeSeconds: number = STALE_LOCK_SECONDS
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);

  const result = await prisma.qboSyncJob.updateMany({
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
 * Get all dead-letter jobs for an organization.
 *
 * Dead-letter jobs have exhausted their retry attempts and require manual review.
 */
export async function getDeadLetters(
  orgId: string
): Promise<QboSyncJob[]> {
  return prisma.qboSyncJob.findMany({
    where: {
      orgId,
      status: "dead_letter",
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Requeue a dead-letter job for retry.
 *
 * Resets the job to "pending" status with attempts=0.
 */
export async function requeueDeadLetter(
  jobId: string
): Promise<void> {
  await prisma.qboSyncJob.update({
    where: { id: jobId },
    data: {
      status: "pending",
      attempts: 0,
      lockedAt: null,
      lockedBy: null,
      errorMessage: null,
      completedAt: null,
    },
  });
}
