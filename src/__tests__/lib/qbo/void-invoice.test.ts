import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboConnection: { findFirst: vi.fn() },
  invoice: { findFirst: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockClient = {
  getInvoice: vi.fn(),
  voidInvoice: vi.fn(),
};
vi.mock("@/lib/qbo/qbo-client", () => mockClient);

vi.mock("@/lib/qbo/qbo-mapper", () => ({
  fromQboCustomer: vi.fn(),
  toQboItem: vi.fn(),
  toQboEstimate: vi.fn(),
}));

// ============================================
// SHARED FIXTURES
// ============================================

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

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.qboSyncLog.create.mockResolvedValue({});
  mockClient.voidInvoice.mockResolvedValue({ Id: "qbo-inv-1", status: "Voided" });
});

// ============================================
// processVoidInvoiceInQbo
// ============================================

describe("processVoidInvoiceInQbo", () => {
  let processVoidInvoiceInQbo: typeof import("@/lib/qbo/qbo-sync").processVoidInvoiceInQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    processVoidInvoiceInQbo = mod.processVoidInvoiceInQbo;
  });

  it("voids QBO invoice with fresh SyncToken", async () => {
    // getActiveConnection: qboConnection.findFirst returns connection
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(mockConnection);
    // invoice.findFirst returns local invoice with qboInvoiceId
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      orgId: "org-1",
      qboInvoiceId: "qbo-inv-1",
    });
    // getInvoice returns QBO invoice with SyncToken and NOT voided
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-1",
      SyncToken: "5",
      status: undefined,
      Balance: 500,
      TotalAmt: 500,
      Line: [],
    });

    const result = await processVoidInvoiceInQbo("org-1", "inv-1");

    // voidInvoice should be called with connection, qboInvoiceId, and fresh SyncToken
    expect(mockClient.voidInvoice).toHaveBeenCalledWith(mockConnection, "qbo-inv-1", "5");

    // Should log success with action "void"
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "invoice",
          entityId: "inv-1",
          action: "void",
          status: "success",
        }),
      })
    );

    expect(result).toEqual({ success: true });
  });

  it("skips void when QBO invoice already voided (guard)", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(mockConnection);
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      orgId: "org-1",
      qboInvoiceId: "qbo-inv-1",
    });
    // getInvoice returns already-voided QBO invoice
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-1",
      SyncToken: "5",
      status: "Voided",
      Balance: 0,
      TotalAmt: 500,
      Line: [],
    });

    const result = await processVoidInvoiceInQbo("org-1", "inv-1");

    // voidInvoice must NOT be called — guard prevents double-void
    expect(mockClient.voidInvoice).not.toHaveBeenCalled();

    // Should still log (idempotent success)
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "void",
          status: "success",
          metadata: expect.objectContaining({ note: "Already voided in QBO — skipped" }),
        }),
      })
    );

    expect(result).toEqual({ success: true });
  });

  it("returns error when invoice not synced to QBO", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(mockConnection);
    // Invoice found but has no qboInvoiceId
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      orgId: "org-1",
      qboInvoiceId: null,
    });

    const result = await processVoidInvoiceInQbo("org-1", "inv-1");

    expect(mockClient.voidInvoice).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "Invoice not synced to QBO" });
  });

  it("returns error when no active QBO connection", async () => {
    // getActiveConnection returns null
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(null);

    const result = await processVoidInvoiceInQbo("org-1", "inv-1");

    expect(mockClient.voidInvoice).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "No active QBO connection" });
  });
});
