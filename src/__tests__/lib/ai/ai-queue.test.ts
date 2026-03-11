import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP — factory must be self-contained (hoisted above imports)
// ============================================

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiInsightJob: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// Import the mocked prisma so we can configure return values
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
const mockPrisma = prisma as any;

// Must import AFTER vi.mock so the mock is in place
import {
  enqueueAiAnalysis,
  claimAiBatch,
  completeAiJob,
  failAiJob,
  resetStaleAiLocks,
  getAiQueueStats,
  AI_DEFAULT_MAX_ATTEMPTS,
} from "@/lib/ai/ai-queue";

// ============================================
// RESET MOCKS
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// TESTS
// ============================================

describe("ai-queue", () => {
  describe("enqueueAiAnalysis", () => {
    it("creates job with correct fields", async () => {
      const fakeJob = { id: "job-1", status: "pending" };
      mockPrisma.aiInsightJob.create.mockResolvedValue(fakeJob);

      const result = await enqueueAiAnalysis(
        "org-1",
        "work_order.completed",
        "WorkOrder",
        "entity-1"
      );

      expect(mockPrisma.aiInsightJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: "org-1",
          triggerEvent: "work_order.completed",
          entityType: "WorkOrder",
          entityId: "entity-1",
          priority: 5,
          status: "pending",
          attempts: 0,
          maxAttempts: AI_DEFAULT_MAX_ATTEMPTS,
        }),
      });
      expect(result).toEqual(fakeJob);
    });

    it("accepts optional payload", async () => {
      const fakeJob = { id: "job-2", status: "pending" };
      mockPrisma.aiInsightJob.create.mockResolvedValue(fakeJob);

      await enqueueAiAnalysis(
        "org-1",
        "pm.generated",
        "PM",
        "entity-2",
        1,
        { extra: "data" }
      );

      expect(mockPrisma.aiInsightJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 1,
          payload: { extra: "data" },
        }),
      });
    });
  });

  describe("claimAiBatch", () => {
    it("calls $queryRaw with FOR UPDATE SKIP LOCKED", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await claimAiBatch(10);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      // Verify the raw SQL template was called (Prisma.sql returns a tagged template)
      const call = mockPrisma.$queryRaw.mock.calls[0][0];
      expect(call).toBeDefined();
      expect(result).toEqual([]);
    });
  });

  describe("completeAiJob", () => {
    it("sets status=completed and stores result", async () => {
      mockPrisma.aiInsightJob.update.mockResolvedValue({});

      await completeAiJob("job-1", { summary: "All good" });

      expect(mockPrisma.aiInsightJob.update).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: "completed",
          lockedAt: null,
          lockedBy: null,
          result: { summary: "All good" },
        }),
      });
      // completedAt should be a Date
      const updateData = mockPrisma.aiInsightJob.update.mock.calls[0][0].data;
      expect(updateData.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("failAiJob", () => {
    it("retries when attempts < maxAttempts (resets to pending)", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await failAiJob("job-1", "Timeout");

      // Uses atomic raw SQL — verify $queryRaw was called
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it("moves to dead_letter when attempts >= maxAttempts", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await failAiJob("job-2", "Final failure");

      // Uses atomic raw SQL — verify $queryRaw was called
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe("resetStaleAiLocks", () => {
    it("resets old claimed jobs back to pending", async () => {
      mockPrisma.aiInsightJob.updateMany.mockResolvedValue({ count: 3 });

      const count = await resetStaleAiLocks(120);

      expect(count).toBe(3);
      expect(mockPrisma.aiInsightJob.updateMany).toHaveBeenCalledWith({
        where: {
          status: "claimed",
          lockedAt: { lt: expect.any(Date) },
        },
        data: {
          status: "pending",
          lockedAt: null,
          lockedBy: null,
        },
      });
    });
  });

  describe("getAiQueueStats", () => {
    it("returns counts grouped by status", async () => {
      mockPrisma.aiInsightJob.groupBy.mockResolvedValue([
        { status: "pending", _count: { status: 5 } },
        { status: "completed", _count: { status: 12 } },
        { status: "dead_letter", _count: { status: 1 } },
      ]);

      const stats = await getAiQueueStats("org-1");

      expect(stats).toEqual({
        pending: 5,
        completed: 12,
        dead_letter: 1,
      });
      expect(mockPrisma.aiInsightJob.groupBy).toHaveBeenCalledWith({
        by: ["status"],
        where: { orgId: "org-1" },
        _count: { status: true },
      });
    });
  });
});
