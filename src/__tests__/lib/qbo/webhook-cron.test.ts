import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================
// MOCKS — must be set up before any imports that use them
// ============================================

const mockPrisma = {
  qboConnection: { findFirst: vi.fn() },
  qboSyncJob: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  invoice: { findFirst: vi.fn(), update: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockEnqueue = vi.fn();
const mockClaimBatch = vi.fn();
const mockComplete = vi.fn();
const mockFail = vi.fn();
const mockResetStaleLocks = vi.fn();
vi.mock("@/lib/qbo/qbo-queue", () => ({
  enqueue: mockEnqueue,
  claimBatch: mockClaimBatch,
  complete: mockComplete,
  fail: mockFail,
  resetStaleLocks: mockResetStaleLocks,
}));

vi.mock("@/lib/qbo/qbo-client", () => ({
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
}));

const mockSyncCustomerToQbo = vi.fn().mockResolvedValue({ success: true });
const mockSyncInvoiceToQbo = vi.fn().mockResolvedValue({ success: true });
const mockSyncMaterialToQbo = vi.fn().mockResolvedValue({ success: true });
const mockSyncLaborRateToQbo = vi.fn().mockResolvedValue({ success: true });
const mockSyncQuoteToQbo = vi.fn().mockResolvedValue({ success: true });
const mockProcessPaymentJob = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/lib/qbo/qbo-sync", () => ({
  syncCustomerToQbo: mockSyncCustomerToQbo,
  syncInvoiceToQbo: mockSyncInvoiceToQbo,
  syncMaterialToQbo: mockSyncMaterialToQbo,
  syncLaborRateToQbo: mockSyncLaborRateToQbo,
  syncQuoteToQbo: mockSyncQuoteToQbo,
  processPaymentJob: mockProcessPaymentJob,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// WEBHOOK — dedup tests
// ============================================

describe("Webhook dedup logic", () => {
  let webhookPOST: typeof import("@/app/api/integrations/qbo/webhook/route").POST;

  beforeEach(async () => {
    const mod = await import("@/app/api/integrations/qbo/webhook/route");
    webhookPOST = mod.POST;
  });

  function makeWebhookRequest(payload: unknown): NextRequest {
    return new NextRequest("https://localhost/api/integrations/qbo/webhook", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
  }

  it("skips enqueue when matching pending job exists", async () => {
    // Connection found
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce({
      id: "conn-1",
      orgId: "org-1",
    });

    // Dedup: existing pending job found
    mockPrisma.qboSyncJob.findFirst.mockResolvedValueOnce({ id: "existing-job-1" });

    const payload = {
      eventNotifications: [
        {
          realmId: "realm-1",
          dataChangeEvent: {
            entities: [{ name: "Payment", id: "pay-100", operation: "Create" }],
          },
        },
      ],
    };

    const response = await webhookPOST(makeWebhookRequest(payload));
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("enqueues when no matching pending job exists", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce({
      id: "conn-1",
      orgId: "org-1",
    });

    // Dedup: no existing job
    mockPrisma.qboSyncJob.findFirst.mockResolvedValueOnce(null);

    // Enqueue returns a job
    mockEnqueue.mockResolvedValueOnce({ id: "new-job-1" });

    const payload = {
      eventNotifications: [
        {
          realmId: "realm-1",
          dataChangeEvent: {
            entities: [{ name: "Payment", id: "pay-200", operation: "Create" }],
          },
        },
      ],
    };

    const response = await webhookPOST(makeWebhookRequest(payload));
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1",     // orgId
      "conn-1",    // connectionId
      "payment",   // entityType
      "org-1",     // placeholder entityId
      "pull",      // action (Payment always "pull")
      5,           // priority
      expect.objectContaining({ qboEntityId: "pay-200", realmId: "realm-1" })
    );

    // Should update the job with qboEntityId and qboRealmId for future dedup
    expect(mockPrisma.qboSyncJob.update).toHaveBeenCalledWith({
      where: { id: "new-job-1" },
      data: { qboEntityId: "pay-200", qboRealmId: "realm-1" },
    });
  });

  it("enqueues new job even when completed job for same entity exists", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce({
      id: "conn-1",
      orgId: "org-1",
    });

    // Dedup check: findFirst with status in ["pending","claimed"] returns null
    // (a completed job for the same entity doesn't block new jobs)
    mockPrisma.qboSyncJob.findFirst.mockResolvedValueOnce(null);

    mockEnqueue.mockResolvedValueOnce({ id: "new-job-2" });

    const payload = {
      eventNotifications: [
        {
          realmId: "realm-1",
          dataChangeEvent: {
            entities: [{ name: "Invoice", id: "inv-300", operation: "Update" }],
          },
        },
      ],
    };

    const response = await webhookPOST(makeWebhookRequest(payload));
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1", "conn-1", "invoice", "org-1", "pull", 5,
      expect.objectContaining({ qboEntityId: "inv-300" })
    );
  });

  it("returns 200 even when connection not found (never error to QBO)", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(null); // No connection

    const payload = {
      eventNotifications: [
        {
          realmId: "unknown-realm",
          dataChangeEvent: {
            entities: [{ name: "Payment", id: "pay-999", operation: "Create" }],
          },
        },
      ],
    };

    const response = await webhookPOST(makeWebhookRequest(payload));
    expect(response.status).toBe(200);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

// ============================================
// CRON — dispatcher tests
// ============================================

describe("Cron dispatcher", () => {
  let cronGET: typeof import("@/app/api/cron/qbo-flush/route").GET;

  beforeEach(async () => {
    // Set the CRON_SECRET env var for auth
    process.env.CRON_SECRET = "test-cron-secret";
    const mod = await import("@/app/api/cron/qbo-flush/route");
    cronGET = mod.GET;
  });

  function makeCronRequest(secret?: string): NextRequest {
    return new NextRequest("https://localhost/api/cron/qbo-flush", {
      method: "GET",
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    });
  }

  it("returns 401 without CRON_SECRET", async () => {
    const response = await cronGET(makeCronRequest("wrong-secret"));
    expect(response.status).toBe(401);
  });

  it("dispatches customer:push to syncCustomerToQbo", async () => {
    mockResetStaleLocks.mockResolvedValueOnce(0);
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-1",
        orgId: "org-1",
        entityType: "customer",
        entityId: "cust-1",
        action: "push",
        payload: null,
      },
    ]);

    const response = await cronGET(makeCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body.data.processed).toBe(1);
    expect(body.data.succeeded).toBe(1);
    expect(mockSyncCustomerToQbo).toHaveBeenCalledWith("org-1", "cust-1");
    expect(mockComplete).toHaveBeenCalledWith("job-1");
  });

  it("dispatches item:push with sourceType=material to syncMaterialToQbo", async () => {
    mockResetStaleLocks.mockResolvedValueOnce(0);
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-2",
        orgId: "org-1",
        entityType: "item",
        entityId: "mat-1",
        action: "push",
        payload: { sourceType: "material" },
      },
    ]);

    const response = await cronGET(makeCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body.data.succeeded).toBe(1);
    expect(mockSyncMaterialToQbo).toHaveBeenCalledWith("org-1", "mat-1");
    expect(mockSyncLaborRateToQbo).not.toHaveBeenCalled();
  });

  it("dispatches item:push with sourceType=laborRate to syncLaborRateToQbo", async () => {
    mockResetStaleLocks.mockResolvedValueOnce(0);
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-3",
        orgId: "org-1",
        entityType: "item",
        entityId: "lr-1",
        action: "push",
        payload: { sourceType: "laborRate" },
      },
    ]);

    const response = await cronGET(makeCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body.data.succeeded).toBe(1);
    expect(mockSyncLaborRateToQbo).toHaveBeenCalledWith("org-1", "lr-1");
    expect(mockSyncMaterialToQbo).not.toHaveBeenCalled();
  });

  it("dispatches payment:pull to processPaymentJob", async () => {
    mockResetStaleLocks.mockResolvedValueOnce(0);
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-4",
        orgId: "org-1",
        entityType: "payment",
        entityId: "org-1",
        action: "pull",
        payload: { qboEntityId: "pay-77", realmId: "realm-99" },
        qboEntityId: null,
        qboRealmId: null,
      },
    ]);

    const response = await cronGET(makeCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body.data.succeeded).toBe(1);
    expect(mockProcessPaymentJob).toHaveBeenCalledWith("org-1", "pay-77", "realm-99");
  });

  it("fails on unknown job type", async () => {
    mockResetStaleLocks.mockResolvedValueOnce(0);
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-5",
        orgId: "org-1",
        entityType: "unknown",
        entityId: "x-1",
        action: "test",
        payload: null,
      },
    ]);

    const response = await cronGET(makeCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body.data.failed).toBe(1);
    expect(body.data.succeeded).toBe(0);
    expect(mockFail).toHaveBeenCalledWith("job-5", expect.stringContaining("Unhandled job type"));
  });

  it("dispatches estimate:push to syncQuoteToQbo", async () => {
    mockResetStaleLocks.mockResolvedValueOnce(0);
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-6",
        orgId: "org-1",
        entityType: "estimate",
        entityId: "quote-1",
        action: "push",
        payload: null,
      },
    ]);

    const response = await cronGET(makeCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body.data.succeeded).toBe(1);
    expect(mockSyncQuoteToQbo).toHaveBeenCalledWith("org-1", "quote-1");
  });

  it("dispatches invoice:push to syncInvoiceToQbo", async () => {
    mockResetStaleLocks.mockResolvedValueOnce(0);
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-7",
        orgId: "org-1",
        entityType: "invoice",
        entityId: "inv-1",
        action: "push",
        payload: null,
      },
    ]);

    const response = await cronGET(makeCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body.data.succeeded).toBe(1);
    expect(mockSyncInvoiceToQbo).toHaveBeenCalledWith("org-1", "inv-1");
  });

  it("resets stale locks before claiming batch", async () => {
    mockResetStaleLocks.mockResolvedValueOnce(3);
    mockClaimBatch.mockResolvedValueOnce([]);

    const response = await cronGET(makeCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body.data.resetStale).toBe(3);
    expect(mockResetStaleLocks).toHaveBeenCalledWith(120);
    expect(mockClaimBatch).toHaveBeenCalledWith(30);
  });
});
