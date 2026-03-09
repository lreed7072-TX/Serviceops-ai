import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockPrisma = {
  qboConnection: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  qboAccountMap: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  invoice: {
    findFirst: vi.fn(),
  },
  customer: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  qboSyncLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock qbo-client functions used by qbo-sync
vi.mock("@/lib/qbo/qbo-client", () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  createInvoice: vi.fn(),
  getValidAccessToken: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Account Mapping Prerequisite Gate — ACCT-03", () => {
  describe("requireAccountMapping", () => {
    test("returns complete=true when all 5 categories are mapped", async () => {
      const { requireAccountMapping } = await import("@/lib/qbo/qbo-sync");

      mockPrisma.qboAccountMap.findMany.mockResolvedValueOnce([
        { category: "labor_income" },
        { category: "materials_income" },
        { category: "service_income" },
        { category: "job_cost_expense" },
        { category: "subcontractor_expense" },
      ]);

      const result = await requireAccountMapping("org-1");
      expect(result).toEqual({ complete: true, missing: [] });
      expect(mockPrisma.qboAccountMap.findMany).toHaveBeenCalledWith({
        where: { orgId: "org-1" },
        select: { category: true },
      });
    });

    test("returns complete=false with missing categories when some are absent", async () => {
      const { requireAccountMapping } = await import("@/lib/qbo/qbo-sync");

      mockPrisma.qboAccountMap.findMany.mockResolvedValueOnce([
        { category: "labor_income" },
        { category: "materials_income" },
        { category: "service_income" },
        // job_cost_expense and subcontractor_expense missing
      ]);

      const result = await requireAccountMapping("org-1");
      expect(result.complete).toBe(false);
      expect(result.missing).toContain("job_cost_expense");
      expect(result.missing).toContain("subcontractor_expense");
      expect(result.missing).toHaveLength(2);
    });

    test("returns all 5 missing when no mappings exist", async () => {
      const { requireAccountMapping } = await import("@/lib/qbo/qbo-sync");

      mockPrisma.qboAccountMap.findMany.mockResolvedValueOnce([]);

      const result = await requireAccountMapping("org-1");
      expect(result.complete).toBe(false);
      expect(result.missing).toHaveLength(5);
    });

    test("only queries the specified org — multi-tenant isolation", async () => {
      const { requireAccountMapping } = await import("@/lib/qbo/qbo-sync");

      mockPrisma.qboAccountMap.findMany.mockResolvedValueOnce([]);

      await requireAccountMapping("org-specific-id");
      expect(mockPrisma.qboAccountMap.findMany).toHaveBeenCalledWith({
        where: { orgId: "org-specific-id" },
        select: { category: true },
      });
    });
  });

  describe("getAccountMapping", () => {
    test("returns the mapping when found", async () => {
      const { getAccountMapping } = await import("@/lib/qbo/qbo-sync");

      mockPrisma.qboAccountMap.findUnique.mockResolvedValueOnce({
        qboAccountId: "42",
        qboAccountName: "Services Income",
        qboAccountType: "Income",
      });

      const result = await getAccountMapping("org-1", "labor_income");
      expect(result).toEqual({
        qboAccountId: "42",
        qboAccountName: "Services Income",
        qboAccountType: "Income",
      });
    });

    test("throws with descriptive error when category not found", async () => {
      const { getAccountMapping } = await import("@/lib/qbo/qbo-sync");

      mockPrisma.qboAccountMap.findUnique.mockResolvedValueOnce(null);

      await expect(getAccountMapping("org-1", "job_cost_expense")).rejects.toThrow(
        'Account mapping required for "job_cost_expense" — configure in QBO Settings'
      );
    });
  });

  describe("syncInvoiceToQbo gate enforcement", () => {
    test("returns error when account mapping is incomplete — before any QBO API call", async () => {
      const { syncInvoiceToQbo } = await import("@/lib/qbo/qbo-sync");
      const { createInvoice } = await import("@/lib/qbo/qbo-client");

      // Connection exists
      mockPrisma.qboConnection.findFirst.mockResolvedValueOnce({
        id: "conn-1",
        orgId: "org-1",
        realmId: "123456789",
        accessToken: "token",
        refreshToken: "refresh",
        accessTokenExpiry: new Date(Date.now() + 3600000),
        isActive: true,
      });

      // Mapping incomplete
      mockPrisma.qboAccountMap.findMany.mockResolvedValueOnce([
        { category: "labor_income" },
        // missing 4 categories
      ]);

      const result = await syncInvoiceToQbo("org-1", "invoice-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Account mapping required");
      expect(result.error).toContain("QBO Settings");

      // The QBO API should NOT have been called
      expect(createInvoice).not.toHaveBeenCalled();
    });
  });
});
