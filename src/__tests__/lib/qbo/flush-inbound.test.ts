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

const mockProcessCdcInvoiceChange = vi.fn();
const mockProcessCdcCustomerPull = vi.fn();
const mockProcessVoidInvoiceInQbo = vi.fn();
vi.mock("@/lib/qbo/qbo-sync", () => ({
  syncCustomerToQbo: vi.fn().mockResolvedValue({ success: true }),
  syncInvoiceToQbo: vi.fn().mockResolvedValue({ success: true }),
  syncMaterialToQbo: vi.fn().mockResolvedValue({ success: true }),
  syncLaborRateToQbo: vi.fn().mockResolvedValue({ success: true }),
  syncQuoteToQbo: vi.fn().mockResolvedValue({ success: true }),
  processPaymentJob: vi.fn().mockResolvedValue({ success: true }),
  processCdcInvoiceChange: mockProcessCdcInvoiceChange,
  processCdcCustomerPull: mockProcessCdcCustomerPull,
  processVoidInvoiceInQbo: mockProcessVoidInvoiceInQbo,
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
// Flush dispatcher — inbound job routing
// ============================================

describe("Flush dispatcher inbound routing", () => {
  let GET: typeof import("@/app/api/cron/qbo-flush/route").GET;

  beforeEach(async () => {
    const mod = await import("@/app/api/cron/qbo-flush/route");
    GET = mod.GET;
  });

  it("dispatches invoice:pull to processCdcInvoiceChange", async () => {
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-pull-inv",
        orgId: "org-1",
        entityType: "invoice",
        entityId: "org-1",
        action: "pull",
        qboEntityId: "qbo-inv-1",
        qboRealmId: "realm-1",
        payload: { qboEntityId: "qbo-inv-1", realmId: "realm-1" },
      },
    ]);

    mockProcessCdcInvoiceChange.mockResolvedValueOnce({ success: true });

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(mockProcessCdcInvoiceChange).toHaveBeenCalledWith("org-1", "qbo-inv-1", "realm-1");
    expect(mockComplete).toHaveBeenCalledWith("job-pull-inv");
    expect(mockFail).not.toHaveBeenCalled();

    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
  });

  it("dispatches customer:pull to processCdcCustomerPull", async () => {
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-pull-cust",
        orgId: "org-1",
        entityType: "customer",
        entityId: "org-1",
        action: "pull",
        qboEntityId: "qbo-cust-5",
        qboRealmId: "realm-1",
        payload: { qboEntityId: "qbo-cust-5", realmId: "realm-1" },
      },
    ]);

    mockProcessCdcCustomerPull.mockResolvedValueOnce({ success: true });

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(mockProcessCdcCustomerPull).toHaveBeenCalledWith("org-1", "qbo-cust-5", "realm-1");
    expect(mockComplete).toHaveBeenCalledWith("job-pull-cust");
    expect(mockFail).not.toHaveBeenCalled();

    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
  });

  it("dispatches invoice:void to processVoidInvoiceInQbo", async () => {
    mockClaimBatch.mockResolvedValueOnce([
      {
        id: "job-void-inv",
        orgId: "org-1",
        entityType: "invoice",
        entityId: "inv-local-1",
        action: "void",
        qboEntityId: null,
        qboRealmId: null,
        payload: null,
      },
    ]);

    mockProcessVoidInvoiceInQbo.mockResolvedValueOnce({ success: true });

    const response = await GET(makeCronRequest());
    const body = await response.json();

    expect(mockProcessVoidInvoiceInQbo).toHaveBeenCalledWith("org-1", "inv-local-1");
    expect(mockComplete).toHaveBeenCalledWith("job-void-inv");
    expect(mockFail).not.toHaveBeenCalled();

    expect(body.data.succeeded).toBe(1);
    expect(body.data.failed).toBe(0);
  });
});
