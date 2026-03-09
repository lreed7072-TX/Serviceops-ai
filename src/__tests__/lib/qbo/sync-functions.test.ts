import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboConnection: { findFirst: vi.fn(), update: vi.fn() },
  qboAccountMap: { findMany: vi.fn(), findUnique: vi.fn() },
  material: { findFirst: vi.fn(), update: vi.fn() },
  laborRate: { findFirst: vi.fn(), update: vi.fn() },
  quote: { findFirst: vi.fn(), update: vi.fn() },
  quoteLineItem: { findMany: vi.fn() },
  invoice: { findFirst: vi.fn(), update: vi.fn() },
  invoiceLineItem: { findMany: vi.fn() },
  customer: { findFirst: vi.fn(), update: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockClient = {
  createItem: vi.fn(),
  getItem: vi.fn(),
  updateItem: vi.fn(),
  createEstimate: vi.fn(),
  getEstimate: vi.fn(),
  updateEstimate: vi.fn(),
  getPayment: vi.fn(),
  getInvoice: vi.fn(),
  createInvoice: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  getCustomer: vi.fn(),
  queryEntities: vi.fn(),
  getValidAccessToken: vi.fn(),
};
vi.mock("@/lib/qbo/qbo-client", () => mockClient);

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

/** Helper: set up complete account mapping (all 5 categories) */
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
    qboAccountName: "Materials Income",
    qboAccountType: "Income",
  });
}

/** Helper: set up active connection */
function mockActiveConnection() {
  mockPrisma.qboConnection.findFirst.mockResolvedValue(mockConnection);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// syncMaterialToQbo
// ============================================

describe("syncMaterialToQbo", () => {
  let syncMaterialToQbo: typeof import("@/lib/qbo/qbo-sync").syncMaterialToQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    syncMaterialToQbo = mod.syncMaterialToQbo;
  });

  it("creates QBO item and stores qboItemId on material", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    // Material with no qboItemId yet
    mockPrisma.material.findFirst.mockResolvedValueOnce({
      id: "mat-1",
      orgId: "org-1",
      name: "Pump Seal Kit",
      manufacturer: "FlowServe",
      unitCost: 125.5,
      qboItemId: null,
    });

    // No collision in QBO
    mockClient.queryEntities.mockResolvedValueOnce([]);

    // createItem returns QBO item
    mockClient.createItem.mockResolvedValueOnce({ Id: "qbo-item-1", Name: "Pump Seal Kit", Type: "NonInventory" });

    const result = await syncMaterialToQbo("org-1", "mat-1");

    expect(result.success).toBe(true);
    expect(result.qboItemId).toBe("qbo-item-1");

    // Should store the qboItemId on material
    expect(mockPrisma.material.update).toHaveBeenCalledWith({
      where: { id: "mat-1" },
      data: { qboItemId: "qbo-item-1" },
    });

    // Should log success
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "item",
          entityId: "mat-1",
          status: "success",
        }),
      })
    );
  });

  it("updates existing QBO item when qboItemId is set", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    // Material already synced
    mockPrisma.material.findFirst.mockResolvedValueOnce({
      id: "mat-2",
      orgId: "org-1",
      name: "Updated Seal Kit",
      manufacturer: "FlowServe",
      unitCost: 130.0,
      qboItemId: "existing-qbo-1",
    });

    // getItem returns existing
    mockClient.getItem.mockResolvedValueOnce({
      Id: "existing-qbo-1",
      SyncToken: "3",
      Name: "Pump Seal Kit",
      Type: "NonInventory",
    });

    // updateItem succeeds
    mockClient.updateItem.mockResolvedValueOnce({
      Id: "existing-qbo-1",
      SyncToken: "4",
      Name: "Updated Seal Kit",
    });

    const result = await syncMaterialToQbo("org-1", "mat-2");

    expect(result.success).toBe(true);
    expect(mockClient.getItem).toHaveBeenCalledWith(mockConnection, "existing-qbo-1");
    expect(mockClient.updateItem).toHaveBeenCalled();
    // createItem should NOT be called
    expect(mockClient.createItem).not.toHaveBeenCalled();
  });

  it("returns error when account mapping incomplete", async () => {
    mockActiveConnection();

    // Incomplete mapping
    mockPrisma.qboAccountMap.findMany.mockResolvedValueOnce([
      { category: "labor_income" },
    ]);

    const result = await syncMaterialToQbo("org-1", "mat-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Account mapping required");
  });

  it("returns error when no active QBO connection", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(null);

    const result = await syncMaterialToQbo("org-1", "mat-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No active QBO connection");
  });
});

// ============================================
// syncQuoteToQbo
// ============================================

describe("syncQuoteToQbo", () => {
  let syncQuoteToQbo: typeof import("@/lib/qbo/qbo-sync").syncQuoteToQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    syncQuoteToQbo = mod.syncQuoteToQbo;
  });

  it("returns error for DRAFT quotes", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    mockPrisma.quote.findFirst.mockResolvedValueOnce({
      id: "quote-1",
      orgId: "org-1",
      status: "DRAFT",
      customer: { id: "cust-1", qboCustomerId: "qbo-cust-1" },
      lineItems: [],
    });

    const result = await syncQuoteToQbo("org-1", "quote-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("SENT or APPROVED");
  });

  it("syncs SENT quote and creates estimate in QBO", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    const mockQuote = {
      id: "quote-2",
      orgId: "org-1",
      status: "SENT",
      quoteNumber: "Q-001",
      validUntil: new Date("2026-04-01"),
      notes: "Test quote",
      total: 500,
      customerId: "cust-1",
      qboEstimateId: null,
      customer: { id: "cust-1", qboCustomerId: "qbo-cust-1", name: "Acme" },
      lineItems: [
        {
          id: "li-1",
          description: "Pump Repair",
          totalPrice: 250,
          quantity: 1,
          unitPrice: 250,
          materialId: "mat-1",
          material: { id: "mat-1", qboItemId: "qbo-item-1", name: "Pump Seal" },
          sortOrder: 0,
        },
        {
          id: "li-2",
          description: "Labor",
          totalPrice: 250,
          quantity: 2.5,
          unitPrice: 100,
          materialId: null,
          material: null,
          sortOrder: 1,
        },
      ],
    };

    mockPrisma.quote.findFirst.mockResolvedValueOnce(mockQuote);

    // Re-fetched line items (for fresh qboItemIds after cascade syncs)
    mockPrisma.quoteLineItem.findMany.mockResolvedValueOnce([
      {
        ...mockQuote.lineItems[0],
        material: { id: "mat-1", qboItemId: "qbo-item-1", name: "Pump Seal" },
      },
      {
        ...mockQuote.lineItems[1],
        material: null,
      },
    ]);

    // createEstimate returns
    mockClient.createEstimate.mockResolvedValueOnce({
      Id: "qbo-est-1",
      SyncToken: "0",
    });

    const result = await syncQuoteToQbo("org-1", "quote-2");

    expect(result.success).toBe(true);
    expect(result.qboEstimateId).toBe("qbo-est-1");

    // Should update quote with qboEstimateId
    expect(mockPrisma.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "quote-2" },
        data: expect.objectContaining({ qboEstimateId: "qbo-est-1" }),
      })
    );

    // createEstimate should have been called
    expect(mockClient.createEstimate).toHaveBeenCalled();
  });

  it("cascade-syncs customer if not yet synced", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    const mockQuote = {
      id: "quote-3",
      orgId: "org-1",
      status: "APPROVED",
      quoteNumber: "Q-002",
      validUntil: null,
      notes: null,
      total: 100,
      customerId: "cust-unsync",
      qboEstimateId: null,
      customer: {
        id: "cust-unsync",
        orgId: "org-1",
        qboCustomerId: null, // Not synced
        name: "Unsynced Customer",
        primaryEmail: "unsync@test.com",
        primaryPhone: null,
        billingStreet1: null,
        billingCity: null,
        billingState: null,
        billingPostalCode: null,
      },
      lineItems: [],
    };

    mockPrisma.quote.findFirst.mockResolvedValueOnce(mockQuote);

    // The cascade syncCustomerToQbo will need:
    // 1. getActiveConnection (already set up by mockActiveConnection via beforeEach reset issue, re-set)
    mockPrisma.qboConnection.findFirst.mockResolvedValue(mockConnection);

    // 2. customer findFirst for the cascade sync
    mockPrisma.customer.findFirst.mockResolvedValueOnce(mockQuote.customer);

    // 3. queryEntities for collision check
    mockClient.queryEntities.mockResolvedValueOnce([]); // No collision

    // 4. createCustomer in QBO
    mockClient.createCustomer.mockResolvedValueOnce({ Id: "qbo-cust-new" });

    // Re-fetched line items
    mockPrisma.quoteLineItem.findMany.mockResolvedValueOnce([]);

    // createEstimate returns
    mockClient.createEstimate.mockResolvedValueOnce({ Id: "qbo-est-2" });

    const result = await syncQuoteToQbo("org-1", "quote-3");

    expect(result.success).toBe(true);

    // Customer should have been synced (createCustomer called)
    expect(mockClient.createCustomer).toHaveBeenCalled();

    // Customer record should have been updated with qboCustomerId
    expect(mockPrisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ qboCustomerId: "qbo-cust-new" }),
      })
    );
  });
});

// ============================================
// syncInvoiceToQbo
// ============================================

describe("syncInvoiceToQbo", () => {
  let syncInvoiceToQbo: typeof import("@/lib/qbo/qbo-sync").syncInvoiceToQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    syncInvoiceToQbo = mod.syncInvoiceToQbo;
  });

  it("includes ItemRef from materialUsage chain", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    const mockInvoice = {
      id: "inv-1",
      orgId: "org-1",
      invoiceNumber: "INV-001",
      dueDate: new Date("2026-04-15"),
      customerId: "cust-1",
      qboInvoiceId: null,
      quoteId: null,
      quote: null,
      customer: { id: "cust-1", qboCustomerId: "qbo-cust-1" },
      lineItems: [
        {
          id: "li-1",
          description: "Pump Seal Kit",
          totalPrice: 250,
          quantity: 2,
          unitPrice: 125,
          sortOrder: 0,
          materialUsageId: "mu-1",
          materialUsage: {
            id: "mu-1",
            materialId: "mat-1",
            material: { id: "mat-1", qboItemId: "qbo-item-99", name: "Pump Seal" },
          },
        },
      ],
    };

    mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockInvoice);

    // Re-fetched line items (with fresh material data)
    mockPrisma.invoiceLineItem.findMany.mockResolvedValueOnce(mockInvoice.lineItems);

    // createInvoice returns
    mockClient.createInvoice.mockResolvedValueOnce({ Id: "qbo-inv-1", SyncToken: "0" });

    const result = await syncInvoiceToQbo("org-1", "inv-1");

    expect(result.success).toBe(true);
    expect(result.qboInvoiceId).toBe("qbo-inv-1");

    // Verify createInvoice was called with itemRef on line
    const createInvoiceArgs = mockClient.createInvoice.mock.calls[0];
    const invoicePayload = createInvoiceArgs[1]; // second arg is the invoice data
    expect(invoicePayload.lineItems[0].itemRef).toBe("qbo-item-99");
  });

  it("includes LinkedTxn when quote has qboEstimateId", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();

    const mockInvoice = {
      id: "inv-2",
      orgId: "org-1",
      invoiceNumber: "INV-002",
      dueDate: new Date("2026-05-01"),
      customerId: "cust-1",
      qboInvoiceId: null,
      quoteId: "quote-5",
      quote: { id: "quote-5", qboEstimateId: "qbo-est-10", status: "APPROVED" },
      customer: { id: "cust-1", qboCustomerId: "qbo-cust-1" },
      lineItems: [
        {
          id: "li-2",
          description: "Service",
          totalPrice: 100,
          quantity: 1,
          unitPrice: 100,
          sortOrder: 0,
          materialUsageId: null,
          materialUsage: null,
        },
      ],
    };

    mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockInvoice);
    mockPrisma.invoiceLineItem.findMany.mockResolvedValueOnce(mockInvoice.lineItems);
    mockClient.createInvoice.mockResolvedValueOnce({ Id: "qbo-inv-2" });

    const result = await syncInvoiceToQbo("org-1", "inv-2");

    expect(result.success).toBe(true);

    // Verify LinkedTxn was included
    const createInvoiceArgs = mockClient.createInvoice.mock.calls[0];
    const invoicePayload = createInvoiceArgs[1];
    expect(invoicePayload.linkedTxn).toEqual([
      { TxnId: "qbo-est-10", TxnType: "Estimate" },
    ]);
  });

  it("cascade-syncs material when qboItemId is null", async () => {
    mockActiveConnection();
    mockCompleteAccountMapping();
    // Need active connection for the cascade material sync too
    mockPrisma.qboConnection.findFirst.mockResolvedValue(mockConnection);

    const mockInvoice = {
      id: "inv-3",
      orgId: "org-1",
      invoiceNumber: "INV-003",
      dueDate: null,
      customerId: "cust-1",
      qboInvoiceId: null,
      quoteId: null,
      quote: null,
      customer: { id: "cust-1", qboCustomerId: "qbo-cust-1" },
      lineItems: [
        {
          id: "li-3",
          description: "Unsynced Material",
          totalPrice: 75,
          quantity: 1,
          unitPrice: 75,
          sortOrder: 0,
          materialUsageId: "mu-2",
          materialUsage: {
            id: "mu-2",
            materialId: "mat-unsynced",
            material: { id: "mat-unsynced", qboItemId: null, name: "Bearing Kit" }, // NOT synced
          },
        },
      ],
    };

    mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockInvoice);

    // The cascade syncMaterialToQbo will:
    // 1. Find material
    mockPrisma.material.findFirst.mockResolvedValueOnce({
      id: "mat-unsynced",
      orgId: "org-1",
      name: "Bearing Kit",
      manufacturer: null,
      unitCost: 75,
      qboItemId: null,
    });

    // 2. No collision
    mockClient.queryEntities.mockResolvedValueOnce([]);

    // 3. Create item
    mockClient.createItem.mockResolvedValueOnce({ Id: "qbo-item-cascade" });

    // Re-fetched line items (now with qboItemId after cascade)
    mockPrisma.invoiceLineItem.findMany.mockResolvedValueOnce([
      {
        ...mockInvoice.lineItems[0],
        materialUsage: {
          ...mockInvoice.lineItems[0].materialUsage,
          material: { id: "mat-unsynced", qboItemId: "qbo-item-cascade", name: "Bearing Kit" },
        },
      },
    ]);

    mockClient.createInvoice.mockResolvedValueOnce({ Id: "qbo-inv-3" });

    const result = await syncInvoiceToQbo("org-1", "inv-3");

    expect(result.success).toBe(true);

    // Material should have been cascade-synced
    expect(mockClient.createItem).toHaveBeenCalled();
    expect(mockPrisma.material.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ qboItemId: "qbo-item-cascade" }),
      })
    );
  });
});

// ============================================
// processPaymentJob
// ============================================

describe("processPaymentJob", () => {
  let processPaymentJob: typeof import("@/lib/qbo/qbo-sync").processPaymentJob;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    processPaymentJob = mod.processPaymentJob;
  });

  it("marks invoice PAID when QBO invoice Balance=0", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(mockConnection);

    // Payment with linked invoice
    mockClient.getPayment.mockResolvedValueOnce({
      Id: "pay-1",
      TotalAmt: 500,
      TxnDate: "2026-03-09",
      CustomerRef: { value: "cust-1" },
      Line: [
        {
          Amount: 500,
          LinkedTxn: [{ TxnId: "qbo-inv-50", TxnType: "Invoice" }],
        },
      ],
    });

    // Our invoice exists and is not PAID
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: "local-inv-1",
      orgId: "org-1",
      qboInvoiceId: "qbo-inv-50",
      status: "SENT",
    });

    // QBO invoice has Balance=0 (fully paid)
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-50",
      Balance: 0,
      TotalAmt: 500,
    });

    const result = await processPaymentJob("org-1", "pay-1", "realm-1");

    expect(result.success).toBe(true);

    // Invoice should be updated to PAID
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "local-inv-1" },
      data: expect.objectContaining({ status: "PAID" }),
    });

    // Should log success with payment metadata
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "payment",
          entityId: "local-inv-1",
          status: "success",
        }),
      })
    );
  });

  it("does NOT mark invoice PAID when Balance > 0", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(mockConnection);

    mockClient.getPayment.mockResolvedValueOnce({
      Id: "pay-2",
      TotalAmt: 200,
      TxnDate: "2026-03-09",
      CustomerRef: { value: "cust-1" },
      Line: [
        {
          Amount: 200,
          LinkedTxn: [{ TxnId: "qbo-inv-51", TxnType: "Invoice" }],
        },
      ],
    });

    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: "local-inv-2",
      orgId: "org-1",
      qboInvoiceId: "qbo-inv-51",
      status: "SENT",
    });

    // Balance is still 300 — partial payment
    mockClient.getInvoice.mockResolvedValueOnce({
      Id: "qbo-inv-51",
      Balance: 300,
      TotalAmt: 500,
    });

    const result = await processPaymentJob("org-1", "pay-2", "realm-1");

    expect(result.success).toBe(true);

    // Invoice should NOT be updated (partial payment)
    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();

    // Should still log the partial payment
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "success",
          metadata: expect.objectContaining({
            note: "Partial payment — invoice not fully paid",
            remainingBalance: 300,
          }),
        }),
      })
    );
  });

  it("handles payment with no linked invoices", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(mockConnection);

    mockClient.getPayment.mockResolvedValueOnce({
      Id: "pay-3",
      TotalAmt: 100,
      TxnDate: "2026-03-09",
      CustomerRef: { value: "cust-1" },
      Line: [], // No linked transactions
    });

    const result = await processPaymentJob("org-1", "pay-3", "realm-1");

    expect(result.success).toBe(true);

    // No invoice updates
    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();

    // Should log that payment had no linked invoices
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            note: "Payment has no linked invoices",
          }),
        }),
      })
    );
  });

  it("returns error when no active connection for realm", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(null);

    const result = await processPaymentJob("org-1", "pay-4", "realm-unknown");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No active QBO connection");
  });
});
