import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboConnection: { findFirst: vi.fn(), update: vi.fn() },
  qboAccountMap: { findMany: vi.fn(), findUnique: vi.fn() },
  qboClassMap: { findUnique: vi.fn(), upsert: vi.fn() },
  timeEntry: { findFirst: vi.fn(), update: vi.fn() },
  stockMovement: { findFirst: vi.fn(), update: vi.fn() },
  invoice: { findFirst: vi.fn(), update: vi.fn() },
  customer: { findFirst: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn(), update: vi.fn() },
  vendor: { findFirst: vi.fn(), update: vi.fn() },
  material: { findFirst: vi.fn(), update: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockCreateTimeActivity = vi.fn();
const mockCreateBill = vi.fn();
const mockCreatePurchase = vi.fn();
const mockCreateCreditMemo = vi.fn();
const mockQueryEntities = vi.fn();
const mockGetValidAccessToken = vi.fn();
const mockCreateVendor = vi.fn();
const mockCreateEmployee = vi.fn();
const mockGetVendor = vi.fn();
const mockGetEmployee = vi.fn();
const mockUpdateVendor = vi.fn();
const mockUpdateEmployee = vi.fn();

vi.mock("@/lib/qbo/qbo-client", () => ({
  createTimeActivity: mockCreateTimeActivity,
  createBill: mockCreateBill,
  createPurchase: mockCreatePurchase,
  createCreditMemo: mockCreateCreditMemo,
  queryEntities: mockQueryEntities,
  getValidAccessToken: mockGetValidAccessToken,
  createVendor: mockCreateVendor,
  createEmployee: mockCreateEmployee,
  getVendor: mockGetVendor,
  getEmployee: mockGetEmployee,
  updateVendor: mockUpdateVendor,
  updateEmployee: mockUpdateEmployee,
  // Stubs for other imports
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  createInvoice: vi.fn(),
  createItem: vi.fn(),
  getItem: vi.fn(),
  updateItem: vi.fn(),
  createEstimate: vi.fn(),
  getPayment: vi.fn(),
  getInvoice: vi.fn(),
  getCustomer: vi.fn(),
  voidInvoice: vi.fn(),
  createClass: vi.fn(),
  queryClasses: vi.fn(),
  getPreferences: vi.fn(),
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
  classTrackingEnabled: false,
  locationTrackingEnabled: false,
  preferencesLastCheckedAt: null,
};

function mockActiveConnection() {
  mockPrisma.qboConnection.findFirst.mockResolvedValue(mockConnection);
}

function mockCompleteAccountMapping() {
  mockPrisma.qboAccountMap.findMany.mockResolvedValue([
    { category: "labor_income" },
    { category: "materials_income" },
    { category: "service_income" },
    { category: "job_cost_expense" },
    { category: "subcontractor_expense" },
  ]);
  mockPrisma.qboAccountMap.findUnique.mockResolvedValue({
    qboAccountId: "acct-1",
    qboAccountName: "Job Cost Expense",
    qboAccountType: "Expense",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// syncTimeEntryToQbo
// ============================================

describe("syncTimeEntryToQbo", () => {
  let syncTimeEntryToQbo: typeof import("@/lib/qbo/qbo-sync").syncTimeEntryToQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    syncTimeEntryToQbo = mod.syncTimeEntryToQbo;
  });

  it("syncs STOPPED time entry with employee cascade", async () => {
    mockActiveConnection();

    const mockTimeEntry = {
      id: "te-1",
      orgId: "org-1",
      userId: "user-1",
      startedAt: new Date("2026-03-09T08:00:00Z"),
      accumulatedSeconds: 5400,
      status: "STOPPED",
      notes: "Pump alignment",
      qboTimeActivityId: null,
      user: {
        id: "user-1",
        orgId: "org-1",
        name: "Mike Tech",
        email: "mike@gps.com",
        role: "TECH",
        qboEmployeeId: null,
      },
      workOrder: {
        id: "wo-1",
        orderType: "WORK_ORDER",
        sourceWorkflowId: null,
        customer: {
          id: "cust-1",
          orgId: "org-1",
          name: "Acme Corp",
          qboCustomerId: "qbo-cust-1",
        },
      },
    };

    mockPrisma.timeEntry.findFirst.mockResolvedValueOnce(mockTimeEntry);

    // Employee cascade — user query returns TECH
    mockPrisma.user.findFirst.mockResolvedValueOnce(mockTimeEntry.user);
    // No collision for employee
    mockQueryEntities.mockResolvedValueOnce([]);
    mockCreateEmployee.mockResolvedValueOnce({ Id: "qbo-emp-1", DisplayName: "Mike Tech" });

    // createTimeActivity returns
    mockCreateTimeActivity.mockResolvedValueOnce({ Id: "qbo-ta-1" });

    const result = await syncTimeEntryToQbo("org-1", "te-1");

    expect(result.success).toBe(true);
    expect(result.qboTimeActivityId).toBe("qbo-ta-1");
    expect(mockCreateTimeActivity).toHaveBeenCalled();

    // Should store qboTimeActivityId
    expect(mockPrisma.timeEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "te-1" },
        data: { qboTimeActivityId: "qbo-ta-1" },
      })
    );
  });

  it("rejects non-STOPPED entry", async () => {
    mockActiveConnection();

    mockPrisma.timeEntry.findFirst.mockResolvedValueOnce({
      id: "te-2",
      orgId: "org-1",
      status: "RUNNING",
      user: { role: "TECH" },
      workOrder: { customer: {} },
    });

    const result = await syncTimeEntryToQbo("org-1", "te-2");

    expect(result.success).toBe(false);
    expect(result.error).toContain("must be STOPPED");
  });

  it("skips already synced (qboTimeActivityId exists)", async () => {
    mockActiveConnection();

    mockPrisma.timeEntry.findFirst.mockResolvedValueOnce({
      id: "te-3",
      orgId: "org-1",
      status: "STOPPED",
      qboTimeActivityId: "already-synced-ta",
      user: { role: "TECH" },
      workOrder: { customer: {} },
    });

    const result = await syncTimeEntryToQbo("org-1", "te-3");

    expect(result.success).toBe(true);
    expect(result.qboTimeActivityId).toBe("already-synced-ta");
    expect(mockCreateTimeActivity).not.toHaveBeenCalled();
  });

  it("marks PM WO as non-billable", async () => {
    mockActiveConnection();

    const mockTimeEntry = {
      id: "te-4",
      orgId: "org-1",
      userId: "user-1",
      startedAt: new Date("2026-03-09T08:00:00Z"),
      accumulatedSeconds: 3600,
      status: "STOPPED",
      notes: null,
      qboTimeActivityId: null,
      user: {
        id: "user-1",
        orgId: "org-1",
        name: "Tech",
        email: "tech@gps.com",
        role: "TECH",
        qboEmployeeId: "qbo-emp-existing",
      },
      workOrder: {
        id: "wo-pm",
        orderType: "MAINTENANCE",
        sourceWorkflowId: "pm-workflow-1", // PM-generated
        customer: {
          id: "cust-1",
          orgId: "org-1",
          name: "Acme",
          qboCustomerId: "qbo-cust-1",
        },
      },
    };

    mockPrisma.timeEntry.findFirst.mockResolvedValueOnce(mockTimeEntry);
    mockCreateTimeActivity.mockResolvedValueOnce({ Id: "qbo-ta-4" });

    const result = await syncTimeEntryToQbo("org-1", "te-4");

    expect(result.success).toBe(true);

    // Verify the payload passed to createTimeActivity has NotBillable
    const payload = mockCreateTimeActivity.mock.calls[0][1];
    expect(payload.BillableStatus).toBe("NotBillable");
  });

  it("includes ClassRef when enabled", async () => {
    const connectionWithClass = { ...mockConnection, classTrackingEnabled: true };
    mockPrisma.qboConnection.findFirst.mockResolvedValue(connectionWithClass);

    const mockTimeEntry = {
      id: "te-5",
      orgId: "org-1",
      userId: "user-1",
      startedAt: new Date("2026-03-09T08:00:00Z"),
      accumulatedSeconds: 1800,
      status: "STOPPED",
      notes: null,
      qboTimeActivityId: null,
      user: {
        id: "user-1",
        orgId: "org-1",
        name: "Tech",
        email: "tech@gps.com",
        role: "TECH",
        qboEmployeeId: "qbo-emp-existing",
      },
      workOrder: {
        id: "wo-2",
        orderType: "WORK_ORDER",
        sourceWorkflowId: null,
        customer: {
          id: "cust-1",
          orgId: "org-1",
          name: "Acme",
          qboCustomerId: "qbo-cust-1",
        },
      },
    };

    mockPrisma.timeEntry.findFirst.mockResolvedValueOnce(mockTimeEntry);

    // Class cache hit
    mockPrisma.qboClassMap.findUnique.mockResolvedValueOnce({
      orgId: "org-1",
      orderType: "WORK_ORDER",
      qboClassId: "cls-1",
      qboClassName: "Work Order",
    });

    mockCreateTimeActivity.mockResolvedValueOnce({ Id: "qbo-ta-5" });

    const result = await syncTimeEntryToQbo("org-1", "te-5");

    expect(result.success).toBe(true);

    const payload = mockCreateTimeActivity.mock.calls[0][1];
    expect(payload.ClassRef).toEqual({ value: "cls-1", name: "Work Order" });
  });
});

// ============================================
// syncExpenseToQbo
// ============================================

describe("syncExpenseToQbo", () => {
  let syncExpenseToQbo: typeof import("@/lib/qbo/qbo-sync").syncExpenseToQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    syncExpenseToQbo = mod.syncExpenseToQbo;
  });

  it("creates Bill when vendor linked", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    mockPrisma.stockMovement.findFirst.mockResolvedValueOnce({
      id: "sm-1",
      orgId: "org-1",
      movementType: "PURCHASE",
      totalCost: 500,
      unitCost: 100,
      quantity: 5,
      reference: "PO-100",
      notes: null,
      createdAt: new Date("2026-03-09T12:00:00Z"),
      qboBillId: null,
      qboPurchaseId: null,
      material: {
        id: "mat-1",
        name: "Bearing Kit",
        vendorId: "vend-1",
        vendor: {
          id: "vend-1",
          orgId: "org-1",
          name: "FlowServe",
          qboVendorId: "qbo-vend-1",
          vendorType: "SUPPLIER",
        },
      },
    });

    mockCreateBill.mockResolvedValueOnce({ Id: "qbo-bill-1" });

    const result = await syncExpenseToQbo("org-1", "sm-1");

    expect(result.success).toBe(true);
    expect(result.qboExpenseId).toBe("qbo-bill-1");
    expect(mockCreateBill).toHaveBeenCalled();
    expect(mockCreatePurchase).not.toHaveBeenCalled();

    expect(mockPrisma.stockMovement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sm-1" },
        data: { qboBillId: "qbo-bill-1" },
      })
    );
  });

  it("creates Purchase when no vendor", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    mockPrisma.stockMovement.findFirst.mockResolvedValueOnce({
      id: "sm-2",
      orgId: "org-1",
      movementType: "PURCHASE",
      totalCost: 75,
      reference: null,
      notes: null,
      createdAt: new Date("2026-03-09T12:00:00Z"),
      qboBillId: null,
      qboPurchaseId: null,
      material: {
        id: "mat-2",
        name: "O-Ring Set",
        vendorId: null,
        vendor: null,
      },
    });

    mockCreatePurchase.mockResolvedValueOnce({ Id: "qbo-purch-1" });

    const result = await syncExpenseToQbo("org-1", "sm-2");

    expect(result.success).toBe(true);
    expect(result.qboExpenseId).toBe("qbo-purch-1");
    expect(mockCreatePurchase).toHaveBeenCalled();
    expect(mockCreateBill).not.toHaveBeenCalled();

    expect(mockPrisma.stockMovement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sm-2" },
        data: { qboPurchaseId: "qbo-purch-1" },
      })
    );
  });

  it("cascades vendor sync when vendor has no qboVendorId", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    mockPrisma.stockMovement.findFirst.mockResolvedValueOnce({
      id: "sm-3",
      orgId: "org-1",
      movementType: "PURCHASE",
      totalCost: 200,
      unitCost: 200,
      quantity: 1,
      reference: null,
      notes: null,
      createdAt: new Date("2026-03-09T12:00:00Z"),
      qboBillId: null,
      qboPurchaseId: null,
      material: {
        id: "mat-3",
        name: "Impeller",
        vendorId: "vend-unsync",
        vendor: {
          id: "vend-unsync",
          orgId: "org-1",
          name: "New Vendor",
          email: null,
          tax1099: false,
          qboVendorId: null,
          vendorType: "SUPPLIER",
        },
      },
    });

    // Vendor cascade — findFirst for the vendor
    mockPrisma.vendor.findFirst.mockResolvedValueOnce({
      id: "vend-unsync",
      orgId: "org-1",
      name: "New Vendor",
      email: null,
      tax1099: false,
      qboVendorId: null,
    });

    // No collision for vendor
    mockQueryEntities.mockResolvedValueOnce([]);
    mockCreateVendor.mockResolvedValueOnce({ Id: "qbo-vend-new" });

    mockCreateBill.mockResolvedValueOnce({ Id: "qbo-bill-cascade" });

    const result = await syncExpenseToQbo("org-1", "sm-3");

    expect(result.success).toBe(true);
    // Vendor should have been cascade-synced
    expect(mockCreateVendor).toHaveBeenCalled();
  });

  it("rejects non-PURCHASE movement", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    mockPrisma.stockMovement.findFirst.mockResolvedValueOnce({
      id: "sm-4",
      orgId: "org-1",
      movementType: "ADJUSTMENT",
      totalCost: 100,
      qboBillId: null,
      qboPurchaseId: null,
      material: { id: "mat-4", name: "Test", vendorId: null, vendor: null },
    });

    const result = await syncExpenseToQbo("org-1", "sm-4");

    expect(result.success).toBe(false);
    expect(result.error).toContain("PURCHASE");
  });
});

// ============================================
// syncCreditMemoToQbo
// ============================================

describe("syncCreditMemoToQbo", () => {
  let syncCreditMemoToQbo: typeof import("@/lib/qbo/qbo-sync").syncCreditMemoToQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    syncCreditMemoToQbo = mod.syncCreditMemoToQbo;
  });

  it("creates CreditMemo with LinkedTxn", async () => {
    mockActiveConnection();

    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: "inv-1",
      orgId: "org-1",
      invoiceNumber: "INV-001",
      total: 500,
      notes: null,
      qboInvoiceId: "qbo-inv-1",
      qboCreditMemoId: null,
      customerId: "cust-1",
      workOrderId: null,
      workOrder: null,
      customer: {
        id: "cust-1",
        orgId: "org-1",
        name: "Acme",
        qboCustomerId: "qbo-cust-1",
      },
      lineItems: [
        { description: "Pump Seal", totalPrice: 250, quantity: 2, unitPrice: 125 },
        { description: "Labor", totalPrice: 250, quantity: 2.5, unitPrice: 100 },
      ],
    });

    mockCreateCreditMemo.mockResolvedValueOnce({ Id: "qbo-cm-1" });

    const result = await syncCreditMemoToQbo("org-1", "inv-1");

    expect(result.success).toBe(true);
    expect(result.qboCreditMemoId).toBe("qbo-cm-1");
    expect(mockCreateCreditMemo).toHaveBeenCalled();

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: { qboCreditMemoId: "qbo-cm-1" },
      })
    );
  });

  it("rejects invoice without qboInvoiceId", async () => {
    mockActiveConnection();

    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: "inv-2",
      orgId: "org-1",
      qboInvoiceId: null,
      qboCreditMemoId: null,
      customer: { qboCustomerId: "qbo-cust-1" },
      lineItems: [],
    });

    const result = await syncCreditMemoToQbo("org-1", "inv-2");

    expect(result.success).toBe(false);
    expect(result.error).toContain("must be synced");
  });

  it("skips if already credited", async () => {
    mockActiveConnection();

    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: "inv-3",
      orgId: "org-1",
      qboInvoiceId: "qbo-inv-3",
      qboCreditMemoId: "already-credited",
      customer: { qboCustomerId: "qbo-cust-1" },
      lineItems: [],
    });

    const result = await syncCreditMemoToQbo("org-1", "inv-3");

    expect(result.success).toBe(true);
    expect(result.qboCreditMemoId).toBe("already-credited");
    expect(mockCreateCreditMemo).not.toHaveBeenCalled();
  });
});
