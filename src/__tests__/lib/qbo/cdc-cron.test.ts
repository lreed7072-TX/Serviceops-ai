import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboConnection: { findMany: vi.fn() },
  qboCdcCursor: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  qboSyncJob: { findFirst: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockCdcRequest = vi.fn();
vi.mock("@/lib/qbo/qbo-client", () => ({
  cdcRequest: mockCdcRequest,
}));

const mockEnqueue = vi.fn();
vi.mock("@/lib/qbo/qbo-queue", () => ({
  enqueue: mockEnqueue,
}));

// ============================================
// SHARED FIXTURES
// ============================================

process.env.CRON_SECRET = "test-secret";

const mockConnection = {
  id: "conn-1",
  orgId: "org-1",
  realmId: "realm-1",
  accessToken: "token",
  refreshToken: "refresh",
  accessTokenExpiry: new Date(Date.now() + 3600000),
  refreshTokenExpiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
  isActive: true,
  companyName: "Test Co",
  connectedAt: new Date(),
  lastSyncAt: null,
  refreshInProgress: false,
  refreshLockedAt: null,
};

/** Empty CDC response with no changed entities */
const emptyCdcResponse = {
  CDCResponse: [{ QueryResponse: [] }],
};

function makeCronRequest(): NextRequest {
  return new NextRequest("https://localhost/api/cron/qbo-cdc", {
    method: "GET",
    headers: { authorization: "Bearer test-secret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.qboSyncLog = { create: vi.fn() } as unknown as typeof mockPrisma.qboSyncLog;
  mockPrisma.qboSyncJob.findFirst.mockResolvedValue(null); // No dedup match by default
  mockPrisma.qboSyncJob.update.mockResolvedValue({});
  mockPrisma.qboCdcCursor.update.mockResolvedValue({});
  mockPrisma.qboCdcCursor.upsert.mockResolvedValue({});
  mockEnqueue.mockResolvedValue({ id: "job-new" });
});

// ============================================
// GET /api/cron/qbo-cdc
// ============================================

describe("CDC cron route", () => {
  let GET: typeof import("@/app/api/cron/qbo-cdc/route").GET;

  beforeEach(async () => {
    const mod = await import("@/app/api/cron/qbo-cdc/route");
    GET = mod.GET;
  });

  it("creates cursor on first run and calls CDC with ~4 hours ago start", async () => {
    mockPrisma.qboConnection.findMany.mockResolvedValueOnce([mockConnection]);
    // No existing cursor (first run)
    mockPrisma.qboCdcCursor.findUnique.mockResolvedValueOnce(null);

    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const createdCursor = {
      orgId: "org-1",
      connectionId: "conn-1",
      lastPollAt: fourHoursAgo,
      lastPollStatus: "success",
      entityTypes: "Customer,Invoice",
    };
    mockPrisma.qboCdcCursor.create.mockResolvedValueOnce(createdCursor);

    mockCdcRequest.mockResolvedValueOnce(emptyCdcResponse);

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);

    // cdcRequest should be called with the connection, entity types, and a Date ~4 hours ago
    expect(mockCdcRequest).toHaveBeenCalledWith(
      mockConnection,
      ["Customer", "Invoice"],
      expect.any(Date)
    );

    // Verify the date passed is approximately 4 hours ago (within 10 seconds tolerance)
    const cdcDate = mockCdcRequest.mock.calls[0][2] as Date;
    const fourHoursAgoMs = Date.now() - 4 * 60 * 60 * 1000;
    expect(Math.abs(cdcDate.getTime() - fourHoursAgoMs)).toBeLessThan(10000);

    // Cursor should be advanced with success status
    expect(mockPrisma.qboCdcCursor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org-1" },
        data: expect.objectContaining({
          lastPollStatus: "success",
        }),
      })
    );

    expect(body.data.orgsPolled).toBe(1);
    expect(body.data.errors).toBe(0);
  });

  it("enqueues jobs for changed entities and advances cursor", async () => {
    mockPrisma.qboConnection.findMany.mockResolvedValueOnce([mockConnection]);

    const lastPollAt = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
    mockPrisma.qboCdcCursor.findUnique.mockResolvedValueOnce({
      orgId: "org-1",
      connectionId: "conn-1",
      lastPollAt,
      lastPollStatus: "success",
      entityTypes: "Customer,Invoice",
    });

    // CDC returns 2 customers and 1 invoice
    mockCdcRequest.mockResolvedValueOnce({
      CDCResponse: [
        {
          QueryResponse: [
            { Customer: [{ Id: "qbo-cust-10" }, { Id: "qbo-cust-11" }] },
            { Invoice: [{ Id: "qbo-inv-20" }] },
          ],
        },
      ],
    });

    // No dedup matches for any entity
    mockPrisma.qboSyncJob.findFirst.mockResolvedValue(null);

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);

    // enqueue should be called 3 times (2 customer:pull + 1 invoice:pull)
    expect(mockEnqueue).toHaveBeenCalledTimes(3);

    // Customer pulls
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1", "conn-1", "customer", "org-1", "pull", 5,
      expect.objectContaining({ qboEntityId: "qbo-cust-10", realmId: "realm-1" })
    );
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1", "conn-1", "customer", "org-1", "pull", 5,
      expect.objectContaining({ qboEntityId: "qbo-cust-11", realmId: "realm-1" })
    );

    // Invoice pull
    expect(mockEnqueue).toHaveBeenCalledWith(
      "org-1", "conn-1", "invoice", "org-1", "pull", 5,
      expect.objectContaining({ qboEntityId: "qbo-inv-20", realmId: "realm-1" })
    );

    // Cursor advanced with success
    expect(mockPrisma.qboCdcCursor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org-1" },
        data: expect.objectContaining({
          lastPollAt: expect.any(Date),
          lastPollStatus: "success",
        }),
      })
    );

    expect(body.data.customersQueued).toBe(2);
    expect(body.data.invoicesQueued).toBe(1);
  });

  it("does not advance cursor on CDC failure", async () => {
    mockPrisma.qboConnection.findMany.mockResolvedValueOnce([mockConnection]);
    mockPrisma.qboCdcCursor.findUnique.mockResolvedValueOnce({
      orgId: "org-1",
      connectionId: "conn-1",
      lastPollAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      lastPollStatus: "success",
      entityTypes: "Customer,Invoice",
    });

    // cdcRequest throws
    mockCdcRequest.mockRejectedValueOnce(new Error("QBO API timeout"));

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);

    // Cursor should be upserted with failure status
    expect(mockPrisma.qboCdcCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org-1" },
        update: expect.objectContaining({
          lastPollStatus: "failed",
          lastPollError: "QBO API timeout",
        }),
      })
    );

    // lastPollAt must NOT be in the upsert update (don't advance on failure)
    const upsertCall = mockPrisma.qboCdcCursor.upsert.mock.calls[0][0];
    expect(upsertCall.update).not.toHaveProperty("lastPollAt");

    // cursor.update (success path) should NOT have been called
    expect(mockPrisma.qboCdcCursor.update).not.toHaveBeenCalled();

    expect(body.data.errors).toBe(1);
  });

  it("isolates multi-org failures — first and third orgs succeed, second fails", async () => {
    const conn2 = { ...mockConnection, id: "conn-2", orgId: "org-2", realmId: "realm-2" };
    const conn3 = { ...mockConnection, id: "conn-3", orgId: "org-3", realmId: "realm-3" };

    mockPrisma.qboConnection.findMany.mockResolvedValueOnce([mockConnection, conn2, conn3]);

    // All 3 orgs have existing cursors
    const cursor = {
      connectionId: "conn-x",
      lastPollAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      lastPollStatus: "success",
      entityTypes: "Customer,Invoice",
    };
    mockPrisma.qboCdcCursor.findUnique
      .mockResolvedValueOnce({ ...cursor, orgId: "org-1", connectionId: "conn-1" })
      .mockResolvedValueOnce({ ...cursor, orgId: "org-2", connectionId: "conn-2" })
      .mockResolvedValueOnce({ ...cursor, orgId: "org-3", connectionId: "conn-3" });

    // org-1 succeeds, org-2 fails, org-3 succeeds
    mockCdcRequest
      .mockResolvedValueOnce(emptyCdcResponse)  // org-1 success
      .mockRejectedValueOnce(new Error("org-2 CDC error"))  // org-2 failure
      .mockResolvedValueOnce(emptyCdcResponse); // org-3 success

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.orgsPolled).toBe(3);
    expect(body.data.errors).toBe(1);

    // org-2's cursor should show failure
    expect(mockPrisma.qboCdcCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org-2" },
        update: expect.objectContaining({ lastPollStatus: "failed" }),
      })
    );

    // org-1 and org-3 should have had their cursors updated (success)
    expect(mockPrisma.qboCdcCursor.update).toHaveBeenCalledTimes(2);
  });
});
