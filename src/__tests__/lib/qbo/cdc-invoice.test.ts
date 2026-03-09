import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboConnection: { findFirst: vi.fn() },
  invoice: { findFirst: vi.fn(), update: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockClient = {
  getInvoice: vi.fn(),
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

const mockServiceOpsInvoice = {
  id: "inv-1",
  orgId: "org-1",
  qboInvoiceId: "qbo-inv-1",
  status: "SENT",
  paidAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: connection found
  mockPrisma.qboConnection.findFirst.mockResolvedValue(mockConnection);
  mockPrisma.qboSyncLog.create.mockResolvedValue({});
  mockPrisma.invoice.update.mockResolvedValue({});
});

// ============================================
// processCdcInvoiceChange
// ============================================

describe("processCdcInvoiceChange", () => {
  let processCdcInvoiceChange: typeof import("@/lib/qbo/qbo-sync").processCdcInvoiceChange;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    processCdcInvoiceChange = mod.processCdcInvoiceChange;
  });

  it("marks invoice CANCELED when QBO status is Voided", async () => {
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-1",
      SyncToken: "3",
      status: "Voided",
      Balance: 0,
      TotalAmt: 500,
      Line: [],
    });
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockServiceOpsInvoice);

    const result = await processCdcInvoiceChange("org-1", "qbo-inv-1", "realm-1");

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: { status: "CANCELED" },
      })
    );
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ voided: true }),
        }),
      })
    );
    expect(result).toEqual({ success: true });
  });

  it("skips when invoice already CANCELED (no-op on void)", async () => {
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-1",
      SyncToken: "3",
      status: "Voided",
      Balance: 0,
      TotalAmt: 500,
      Line: [],
    });
    // ServiceOps invoice is already CANCELED
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      ...mockServiceOpsInvoice,
      status: "CANCELED",
    });

    const result = await processCdcInvoiceChange("org-1", "qbo-inv-1", "realm-1");

    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("marks invoice PAID when Balance is 0 and not voided", async () => {
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-1",
      SyncToken: "2",
      status: undefined,
      Balance: 0,
      TotalAmt: 500,
      Line: [],
    });
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockServiceOpsInvoice);

    const result = await processCdcInvoiceChange("org-1", "qbo-inv-1", "realm-1");

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          status: "PAID",
          paidAt: expect.any(Date),
        }),
      })
    );
    expect(result).toEqual({ success: true });
  });

  it("skips when invoice already PAID (no-op on full payment)", async () => {
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-1",
      SyncToken: "2",
      status: undefined,
      Balance: 0,
      TotalAmt: 500,
      Line: [],
    });
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      ...mockServiceOpsInvoice,
      status: "PAID",
    });

    const result = await processCdcInvoiceChange("org-1", "qbo-inv-1", "realm-1");

    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("logs partial payment without status change", async () => {
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-1",
      SyncToken: "2",
      status: undefined,
      Balance: 250,
      TotalAmt: 500,
      Line: [],
    });
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockServiceOpsInvoice);

    const result = await processCdcInvoiceChange("org-1", "qbo-inv-1", "realm-1");

    // No status change
    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();

    // Log with partial payment metadata
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            remainingBalance: 250,
            note: "Partial payment",
          }),
        }),
      })
    );
    expect(result).toEqual({ success: true });
  });

  it("returns success when no matching ServiceOps invoice", async () => {
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-orphan",
      SyncToken: "1",
      status: undefined,
      Balance: 0,
      TotalAmt: 100,
      Line: [],
    });
    // No ServiceOps invoice found for this QBO invoice
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

    const result = await processCdcInvoiceChange("org-1", "qbo-inv-orphan", "realm-1");

    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
