import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP — factory must be self-contained (hoisted above imports)
// ============================================

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: { findFirst: vi.fn() },
    workOrder: { findFirst: vi.fn(), findMany: vi.fn() },
    taskMeasurement: { findMany: vi.fn() },
    taskFinding: { findMany: vi.fn() },
    workflowDefinition: { findMany: vi.fn() },
    taskInstance: { findMany: vi.fn() },
    taskMaterialUsage: { findMany: vi.fn() },
    timeEntry: { findMany: vi.fn() },
    quote: { findFirst: vi.fn(), findMany: vi.fn() },
    aiAnalysisContext: { upsert: vi.fn() },
    aiInsight: { create: vi.fn() },
    aiInsightJob: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/ai/anthropic", () => ({
  getAnthropicClient: vi.fn(),
}));

vi.mock("@/lib/ai/ai-queue", () => ({
  completeAiJob: vi.fn(),
  failAiJob: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyMultipleUsers: vi.fn(),
}));

// Import mocked modules
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
const mockPrisma = prisma as any;

import { getAnthropicClient } from "@/lib/ai/anthropic";
const mockGetClient = getAnthropicClient as any;

import { completeAiJob, failAiJob } from "@/lib/ai/ai-queue";
const mockCompleteAiJob = completeAiJob as any;
const mockFailAiJob = failAiJob as any;

import { notifyMultipleUsers } from "@/lib/notifications";
const mockNotifyMultipleUsers = notifyMultipleUsers as any;

// Import after mocks
import {
  buildAssetContext,
  processAiJob,
} from "@/lib/ai/ai-engine";

// ============================================
// RESET MOCKS
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// TESTS
// ============================================

describe("ai-engine", () => {
  describe("buildAssetContext", () => {
    it("aggregates asset, workHistory, measurements, findings, and pmSchedules", async () => {
      const fakeAsset = { id: "asset-1", name: "Pump A", manufacturer: "Flowserve" };
      const fakeWOs = [{ id: "wo-1", title: "Repair", status: "COMPLETED" }];
      const fakeMeasurements = [{ name: "Vibration", numericValue: 4.2, unit: "mm/s" }];
      const fakeFindings = [{ category: "DEFICIENCY", details: "Bearing wear detected" }];
      const fakePMs = [{ name: "Monthly PM", frequencyType: "MONTHLY" }];

      mockPrisma.asset.findFirst.mockResolvedValue(fakeAsset);
      mockPrisma.workOrder.findMany.mockResolvedValue(fakeWOs);
      mockPrisma.taskMeasurement.findMany.mockResolvedValue(fakeMeasurements);
      mockPrisma.taskFinding.findMany.mockResolvedValue(fakeFindings);
      mockPrisma.workflowDefinition.findMany.mockResolvedValue(fakePMs);

      const result = await buildAssetContext("org-1", "asset-1");

      expect(result.asset).toEqual(fakeAsset);
      expect(result.workHistory).toEqual(fakeWOs);
      expect(result.measurements).toEqual(fakeMeasurements);
      expect(result.findings).toEqual(fakeFindings);
      expect(result.pmSchedules).toEqual(fakePMs);

      // Verify all 5 queries were called
      expect(mockPrisma.asset.findFirst).toHaveBeenCalledOnce();
      expect(mockPrisma.workOrder.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.taskMeasurement.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.taskFinding.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.workflowDefinition.findMany).toHaveBeenCalledOnce();
    });
  });

  describe("processAiJob", () => {
    const fakeJob = {
      id: "job-1",
      orgId: "org-1",
      triggerEvent: "work_order.completed",
      entityType: "WorkOrder",
      entityId: "wo-1",
      priority: 5,
      status: "claimed",
      payload: null,
      result: null,
      lockedAt: new Date(),
      lockedBy: "test-locker",
      claimedAt: new Date(),
      completedAt: null,
      failedAt: null,
      attempts: 0,
      maxAttempts: 3,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    function setupMocks(insightSeverity: string = "MEDIUM") {
      // Work order context mocks
      mockPrisma.workOrder.findFirst.mockResolvedValue({
        id: "wo-1",
        title: "Pump Repair",
        status: "COMPLETED",
        asset: { id: "asset-1", name: "Pump A" },
        customer: { id: "cust-1", name: "Acme Corp" },
        site: { id: "site-1", name: "Main Plant" },
      });
      mockPrisma.taskInstance.findMany.mockResolvedValue([]);
      mockPrisma.taskMaterialUsage.findMany.mockResolvedValue([]);
      mockPrisma.timeEntry.findMany.mockResolvedValue([]);

      // Upsert context
      mockPrisma.aiAnalysisContext.upsert.mockResolvedValue({ id: "ctx-1" });

      // Claude response
      const claudeResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              insights: [
                {
                  type: "REPORT_DRAFT",
                  severity: insightSeverity,
                  title: "Service Report Summary",
                  summary: "Pump repair completed successfully.",
                  confidence: 0.9,
                  actionRecommended: "Schedule follow-up in 30 days",
                  details: { keyFindings: ["Bearing replaced"] },
                },
              ],
            }),
          },
        ],
        usage: { input_tokens: 500, output_tokens: 200 },
      };

      const mockCreate = vi.fn().mockResolvedValue(claudeResponse);
      mockGetClient.mockReturnValue({ messages: { create: mockCreate } });

      // AiInsight creation
      mockPrisma.aiInsight.create.mockResolvedValue({
        id: "insight-1",
        severity: insightSeverity,
        title: "Service Report Summary",
        summary: "Pump repair completed successfully.",
        insightType: "REPORT_DRAFT",
      });

      mockCompleteAiJob.mockResolvedValue(undefined);
      mockNotifyMultipleUsers.mockResolvedValue([]);
    }

    it("calls Claude and stores resulting insights", async () => {
      setupMocks("MEDIUM");

      const result = await processAiJob(fakeJob as any);

      // Verify Claude was called
      const mockClient = mockGetClient();
      expect(mockClient.messages.create).toHaveBeenCalledOnce();

      // Verify insight was created
      expect(mockPrisma.aiInsight.create).toHaveBeenCalledOnce();
      const createCall = mockPrisma.aiInsight.create.mock.calls[0][0];
      expect(createCall.data.orgId).toBe("org-1");
      expect(createCall.data.entityType).toBe("WorkOrder");
      expect(createCall.data.entityId).toBe("wo-1");
      expect(createCall.data.insightType).toBe("REPORT_DRAFT");
      expect(createCall.data.llmModel).toBe("claude-sonnet-4-20250514");
      expect(createCall.data.tokensUsed).toBe(700);

      // Verify job was marked complete
      expect(mockCompleteAiJob).toHaveBeenCalledWith("job-1", expect.objectContaining({
        insightsCreated: 1,
        tokensUsed: 700,
      }));

      // Verify result
      expect(result.insightsCreated).toBe(1);
      expect(result.tokensUsed).toBe(700);

      // MEDIUM severity should NOT trigger admin notification
      expect(mockNotifyMultipleUsers).not.toHaveBeenCalled();
    });

    it("notifies admins on HIGH severity insights", async () => {
      setupMocks("HIGH");

      // Admin lookup raw query
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: "admin-1" },
        { id: "admin-2" },
      ]);

      const result = await processAiJob(fakeJob as any);

      expect(result.insightsCreated).toBe(1);

      // Verify admin notification was sent
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockNotifyMultipleUsers).toHaveBeenCalledWith(
        ["admin-1", "admin-2"],
        "org-1",
        "WORK_ORDER_STATUS_CHANGED",
        expect.stringContaining("AI Insight"),
        expect.any(String),
        undefined,
        expect.objectContaining({ severity: "HIGH" })
      );
    });

    it("marks job as failed on error and rethrows", async () => {
      // Setup mocks that will throw
      mockPrisma.workOrder.findFirst.mockRejectedValue(
        new Error("Database connection lost")
      );
      mockPrisma.taskInstance.findMany.mockResolvedValue([]);
      mockPrisma.taskMaterialUsage.findMany.mockResolvedValue([]);
      mockPrisma.timeEntry.findMany.mockResolvedValue([]);
      mockFailAiJob.mockResolvedValue(undefined);

      await expect(processAiJob(fakeJob as any)).rejects.toThrow(
        "Database connection lost"
      );

      expect(mockFailAiJob).toHaveBeenCalledWith(
        "job-1",
        "Database connection lost"
      );
    });
  });
});
