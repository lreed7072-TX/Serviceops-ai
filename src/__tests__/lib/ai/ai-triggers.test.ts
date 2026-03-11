import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ai-queue module before importing triggers
vi.mock("@/lib/ai/ai-queue", () => ({
  enqueueAiAnalysis: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
}));

import { enqueueAiAnalysis } from "@/lib/ai/ai-queue";
import {
  triggerWorkOrderCompleted,
  triggerWorkOrderCreated,
  triggerMeasurementRecorded,
  triggerFindingCreated,
  triggerQuoteCreated,
  triggerQuoteSent,
  triggerPMExecuted,
} from "@/lib/ai/ai-triggers";

const mockEnqueue = enqueueAiAnalysis as ReturnType<typeof vi.fn>;

describe("ai-triggers", () => {
  beforeEach(() => {
    mockEnqueue.mockClear();
  });

  // -------------------------------------------------------
  // triggerWorkOrderCompleted
  // -------------------------------------------------------

  it("enqueues report analysis + asset analysis when assetId is provided", async () => {
    await triggerWorkOrderCompleted("org-1", "wo-1", "asset-1");

    expect(mockEnqueue).toHaveBeenCalledTimes(2);

    // First call: work order report analysis
    expect(mockEnqueue).toHaveBeenNthCalledWith(
      1,
      "org-1",
      "work_order.completed",
      "WorkOrder",
      "wo-1",
      5
    );

    // Second call: asset-level analysis
    expect(mockEnqueue).toHaveBeenNthCalledWith(
      2,
      "org-1",
      "work_order.completed.asset_analysis",
      "Asset",
      "asset-1",
      9
    );
  });

  it("skips asset analysis when assetId is null (1 call only)", async () => {
    await triggerWorkOrderCompleted("org-1", "wo-2", null);

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1",
      "work_order.completed",
      "WorkOrder",
      "wo-2",
      5
    );
  });

  // -------------------------------------------------------
  // triggerMeasurementRecorded
  // -------------------------------------------------------

  it("enqueues measurement analysis with priority 5 and payload", async () => {
    const measurement = { name: "vibration_rms", value: 4.2 };
    await triggerMeasurementRecorded("org-1", "asset-1", measurement);

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1",
      "measurement.recorded",
      "Asset",
      "asset-1",
      5,
      measurement
    );
  });

  // -------------------------------------------------------
  // triggerFindingCreated
  // -------------------------------------------------------

  it("enqueues finding analysis with priority 3 and payload", async () => {
    await triggerFindingCreated("org-1", "asset-1", "bearing", "Excessive play in drive-end bearing");

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1",
      "finding.created",
      "Asset",
      "asset-1",
      3,
      { category: "bearing", details: "Excessive play in drive-end bearing" }
    );
  });

  // -------------------------------------------------------
  // triggerWorkOrderCreated
  // -------------------------------------------------------

  it("enqueues work order created with priority 3", async () => {
    await triggerWorkOrderCreated("org-1", "wo-3");

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1",
      "work_order.created",
      "WorkOrder",
      "wo-3",
      3
    );
  });

  // -------------------------------------------------------
  // triggerQuoteCreated
  // -------------------------------------------------------

  it("enqueues quote created with priority 5", async () => {
    await triggerQuoteCreated("org-1", "quote-1");

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1",
      "quote.created",
      "Quote",
      "quote-1",
      5
    );
  });

  // -------------------------------------------------------
  // triggerQuoteSent
  // -------------------------------------------------------

  it("enqueues quote sent with priority 9", async () => {
    await triggerQuoteSent("org-1", "quote-2");

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1",
      "quote.sent",
      "Quote",
      "quote-2",
      9
    );
  });

  // -------------------------------------------------------
  // triggerPMExecuted
  // -------------------------------------------------------

  it("enqueues PM executed with priority 5 and scheduleId payload", async () => {
    await triggerPMExecuted("org-1", "asset-2", "pm-sched-1");

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1",
      "pm_schedule.executed",
      "Asset",
      "asset-2",
      5,
      { scheduleId: "pm-sched-1" }
    );
  });
});
