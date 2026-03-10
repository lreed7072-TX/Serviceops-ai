import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboSyncJob: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockResetStaleLocks = vi.fn();
const mockClaimBatch = vi.fn();
const mockComplete = vi.fn();
const mockFail = vi.fn();
vi.mock("@/lib/qbo/qbo-queue", () => ({
  claimBatch: mockClaimBatch,
  complete: mockComplete,
  fail: mockFail,
  resetStaleLocks: mockResetStaleLocks,
}));

const mockSyncVendorToQbo = vi.fn();
const mockSyncEmployeeToQbo = vi.fn();
const mockSyncTimeEntryToQbo = vi.fn();
const mockSyncExpenseToQbo = vi.fn();
const mockSyncCreditMemoToQbo = vi.fn();

vi.mock("@/lib/qbo/qbo-sync", () => ({
  syncCustomerToQbo: vi.fn().mockResolvedValue({ success: true }),
  syncInvoiceToQbo: vi.fn().mockResolvedValue({ success: true }),
  syncMaterialToQbo: vi.fn().mockResolvedValue({ success: true }),
  syncLaborRateToQbo: vi.fn().mockResolvedValue({ success: true }),
  syncQuoteToQbo: vi.fn().mockResolvedValue({ success: true }),
  processPaymentJob: vi.fn().mockResolvedValue({ success: true }),
  processCdcInvoiceChange: vi.fn().mockResolvedValue({ success: true }),
  processCdcCustomerPull: vi.fn().mockResolvedValue({ success: true }),
  processVoidInvoiceInQbo: vi.fn().mockResolvedValue({ success: true }),
  syncVendorToQbo: mockSyncVendorToQbo,
  syncEmployeeToQbo: mockSyncEmployeeToQbo,
  syncTimeEntryToQbo: mockSyncTimeEntryToQbo,
  syncExpenseToQbo: mockSyncExpenseToQbo,
  syncCreditMemoToQbo: mockSyncCreditMemoToQbo,
}));

// ============================================
// SETUP
// ============================================

process.env.CRON_SECRET = "test-secret";

function makeCronRequest(): NextRequest {
  return new NextRequest("https://localhost/api/cron/qbo-flush", {
    method: "GET",
    headers: { authorization: "Bearer test-secret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResetStaleLocks.mockResolvedValue(0);
  mockComplete.mockResolvedValue({});
  mockFail.mockResolvedValue({});
});

// ============================================
// Flush dispatcher — Phase 5 job routing
// ============================================

describe("Flush dispatcher Phase 5 routing", () => {
  let GET: typeof import("@/app/api/cron/qbo-flush/route").GET;

  beforeEach(async () => {
    const mod = await import("@/app/api/cron/qbo-flush/route");
    GET = mod.GET;
  });

  it("routes vendor:push to syncVendorToQbo", async () => {
    mockSyncVendorToQbo.mockResolvedValueOnce({ success: true });

    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-vend",
        orgId: "org-1",
        entityType: "vendor",
        entityId: "vend-1",
        action: "push",
        qboEntityId: null,
        qboRealmId: null,
        payload: null,
      },
    ]);

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(mockSyncVendorToQbo).toHaveBeenCalledWith("org-1", "vend-1");
    expect(mockComplete).toHaveBeenCalledWith("job-vend");
    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
  });

  it("routes employee:push to syncEmployeeToQbo", async () => {
    mockSyncEmployeeToQbo.mockResolvedValueOnce({ success: true });

    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-emp",
        orgId: "org-1",
        entityType: "employee",
        entityId: "user-1",
        action: "push",
        qboEntityId: null,
        qboRealmId: null,
        payload: null,
      },
    ]);

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(mockSyncEmployeeToQbo).toHaveBeenCalledWith("org-1", "user-1");
    expect(mockComplete).toHaveBeenCalledWith("job-emp");
    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
  });

  it("routes timeActivity:push to syncTimeEntryToQbo", async () => {
    mockSyncTimeEntryToQbo.mockResolvedValueOnce({ success: true });

    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-ta",
        orgId: "org-1",
        entityType: "timeActivity",
        entityId: "te-1",
        action: "push",
        qboEntityId: null,
        qboRealmId: null,
        payload: null,
      },
    ]);

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(mockSyncTimeEntryToQbo).toHaveBeenCalledWith("org-1", "te-1");
    expect(mockComplete).toHaveBeenCalledWith("job-ta");
    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
  });

  it("routes expense:push to syncExpenseToQbo", async () => {
    mockSyncExpenseToQbo.mockResolvedValueOnce({ success: true });

    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-exp",
        orgId: "org-1",
        entityType: "expense",
        entityId: "sm-1",
        action: "push",
        qboEntityId: null,
        qboRealmId: null,
        payload: null,
      },
    ]);

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(mockSyncExpenseToQbo).toHaveBeenCalledWith("org-1", "sm-1");
    expect(mockComplete).toHaveBeenCalledWith("job-exp");
    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
  });

  it("routes creditMemo:push to syncCreditMemoToQbo", async () => {
    mockSyncCreditMemoToQbo.mockResolvedValueOnce({ success: true });

    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-cm",
        orgId: "org-1",
        entityType: "creditMemo",
        entityId: "inv-1",
        action: "push",
        qboEntityId: null,
        qboRealmId: null,
        payload: null,
      },
    ]);

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(mockSyncCreditMemoToQbo).toHaveBeenCalledWith("org-1", "inv-1");
    expect(mockComplete).toHaveBeenCalledWith("job-cm");
    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
  });
});
