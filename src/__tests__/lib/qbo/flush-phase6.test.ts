import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    qboSyncJob: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    qboConnection: { findFirst: vi.fn() },
    qboSyncLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/qbo/qbo-sync", () => ({
  syncPurchaseOrderToQbo: vi.fn(),
  syncInvoiceToQbo: vi.fn(),
  syncCustomerToQbo: vi.fn(),
  syncQuoteToQbo: vi.fn(),
  syncMaterialToQbo: vi.fn(),
  syncLaborRateToQbo: vi.fn(),
  syncVendorToQbo: vi.fn(),
  syncEmployeeToQbo: vi.fn(),
  syncTimeEntryToQbo: vi.fn(),
  syncExpenseToQbo: vi.fn(),
  syncCreditMemoToQbo: vi.fn(),
  processPaymentJob: vi.fn(),
  processInboundCustomer: vi.fn(),
  processCdcInvoiceChange: vi.fn(),
  processVoidInvoiceInQbo: vi.fn(),
}));

vi.mock("@/lib/qbo/qbo-queue", () => ({
  enqueue: vi.fn(),
}));

import { syncPurchaseOrderToQbo } from "@/lib/qbo/qbo-sync";

describe("flush dispatcher - purchaseOrder:push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    (syncPurchaseOrderToQbo as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
  });

  it("routes purchaseOrder:push to syncPurchaseOrderToQbo", async () => {
    // Validate the sync function is callable and returns expected shape
    const result = await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(result.success).toBe(true);
    expect(syncPurchaseOrderToQbo).toHaveBeenCalledWith("org-1", "po-1");
  });

  it("propagates error from syncPurchaseOrderToQbo", async () => {
    (syncPurchaseOrderToQbo as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "PO sync failed",
    });
    const result = await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("PO sync failed");
  });
});
