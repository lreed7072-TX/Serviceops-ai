import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma (overrides global setup mock for this file)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    qboConnection: { findFirst: vi.fn() },
    purchaseOrder: { findUnique: vi.fn(), update: vi.fn() },
    vendor: { findUnique: vi.fn() },
    qboSyncLog: { create: vi.fn() },
    qboClassMap: { findUnique: vi.fn() },
    qboLocationMap: { findUnique: vi.fn() },
    site: { findUnique: vi.fn() },
  },
}));

// Mock QBO client
vi.mock("@/lib/qbo/qbo-client", () => ({
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  getPurchaseOrder: vi.fn(),
  createClass: vi.fn(),
  createLocation: vi.fn(),
  refreshAccessToken: vi.fn(),
  getValidAccessToken: vi.fn(),
  queryEntities: vi.fn(),
}));

// Mock qbo-queue
vi.mock("@/lib/qbo/qbo-queue", () => ({
  enqueue: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from "@/lib/qbo/qbo-client";
import { syncPurchaseOrderToQbo } from "@/lib/qbo/qbo-sync";

describe("syncPurchaseOrderToQbo", () => {
  const mockConnection = {
    id: "conn-1",
    orgId: "org-1",
    realmId: "realm-1",
    accessToken: "token",
    refreshToken: "refresh",
    isActive: true,
    classTrackingEnabled: false,
    locationTrackingEnabled: false,
  };

  const mockPO = {
    id: "po-1",
    orgId: "org-1",
    poNumber: "PO-00001",
    vendorId: "vendor-1",
    status: "SENT",
    notes: "Test PO",
    expectedDate: new Date("2026-04-01"),
    totalAmount: 1000,
    qboPurchaseOrderId: null,
    lines: [
      {
        id: "line-1",
        description: "Part A",
        quantity: 10,
        unitPrice: 100,
        amount: 1000,
        material: null,
      },
    ],
    vendor: { id: "vendor-1", qboVendorId: "qbo-vendor-1", name: "Test Vendor" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.qboConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConnection);
    (prisma.purchaseOrder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPO);
    (prisma.vendor.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      qboVendorId: "qbo-vendor-1",
    });
    (prisma.purchaseOrder.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.qboSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (createPurchaseOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      Id: "qbo-po-1",
      SyncToken: "0",
    });
  });

  it("creates PO in QBO when no qboPurchaseOrderId exists", async () => {
    const result = await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(result.success).toBe(true);
    expect(result.qboPurchaseOrderId).toBe("qbo-po-1");
    expect(createPurchaseOrder).toHaveBeenCalled();
    expect(updatePurchaseOrder).not.toHaveBeenCalled();
  });

  it("updates PO in QBO when qboPurchaseOrderId exists", async () => {
    (prisma.purchaseOrder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockPO,
      qboPurchaseOrderId: "qbo-po-existing",
    });
    (updatePurchaseOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      Id: "qbo-po-existing",
      SyncToken: "1",
    });

    const result = await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(result.success).toBe(true);
    expect(updatePurchaseOrder).toHaveBeenCalled();
    expect(createPurchaseOrder).not.toHaveBeenCalled();
  });

  it("returns error when no QBO connection", async () => {
    (prisma.qboConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No active QBO connection");
  });

  it("returns error when PO not found", async () => {
    (prisma.purchaseOrder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("updates local PO record with qboPurchaseOrderId and qboSyncedAt", async () => {
    await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "po-1" },
        data: expect.objectContaining({ qboPurchaseOrderId: "qbo-po-1" }),
      })
    );
  });

  it("logs success to QboSyncLog", async () => {
    await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(prisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "purchaseOrder",
          action: "push",
          status: "success",
        }),
      })
    );
  });

  it("returns error on QBO API failure", async () => {
    (createPurchaseOrder as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("QBO API error")
    );
    const result = await syncPurchaseOrderToQbo("org-1", "po-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("QBO API error");
  });
});
