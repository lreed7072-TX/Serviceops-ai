import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboConnection: { findFirst: vi.fn() },
  customer: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockClient = {
  getCustomer: vi.fn(),
};
vi.mock("@/lib/qbo/qbo-client", () => mockClient);

// fromQboCustomer is a pure function called internally — no mock needed for qbo-mapper
// but we do need to mock it to avoid its import chain
vi.mock("@/lib/qbo/qbo-mapper", () => ({
  fromQboCustomer: vi.fn((qbo) => ({
    name: qbo.DisplayName,
    primaryEmail: qbo.PrimaryEmailAddr?.Address ?? null,
    primaryPhone: qbo.PrimaryPhone?.FreeFormNumber ?? null,
    billingStreet1: qbo.BillAddr?.Line1 ?? null,
    billingCity: qbo.BillAddr?.City ?? null,
    billingState: qbo.BillAddr?.CountrySubDivisionCode ?? null,
    billingPostalCode: qbo.BillAddr?.PostalCode ?? null,
  })),
  toQboItem: vi.fn(),
  toQboEstimate: vi.fn(),
}));

// ============================================
// SHARED FIXTURES
// ============================================

const mockQboCustomer = {
  Id: "qbo-cust-1",
  SyncToken: "0",
  DisplayName: "Acme Corp",
  PrimaryEmailAddr: { Address: "billing@acme.com" },
  PrimaryPhone: { FreeFormNumber: "555-1234" },
  BillAddr: {
    Line1: "123 Main",
    City: "Dallas",
    CountrySubDivisionCode: "TX",
    PostalCode: "75001",
  },
  Active: true,
};

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

const mockExistingCustomer = {
  id: "cust-local-1",
  orgId: "org-1",
  name: "Acme Corp Old",
  primaryEmail: "billing@acme.com",
  qboCustomerId: "qbo-cust-1",
  status: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.qboSyncLog.create.mockResolvedValue({});
  mockPrisma.customer.update.mockResolvedValue({ id: "cust-local-1" });
  mockPrisma.customer.create.mockResolvedValue({ id: "cust-local-new" });
});

// ============================================
// processInboundCustomer
// ============================================

describe("processInboundCustomer", () => {
  let processInboundCustomer: typeof import("@/lib/qbo/qbo-sync").processInboundCustomer;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    processInboundCustomer = mod.processInboundCustomer;
  });

  it("updates existing customer found by QBO ID", async () => {
    // First findFirst (by qboCustomerId) returns existing customer
    mockPrisma.customer.findFirst.mockResolvedValueOnce(mockExistingCustomer);

    const result = await processInboundCustomer("org-1", mockQboCustomer, "conn-1");

    // Should update, not create
    expect(mockPrisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockExistingCustomer.id },
        data: expect.objectContaining({
          name: "Acme Corp",
          primaryEmail: "billing@acme.com",
          primaryPhone: "555-1234",
          billingStreet1: "123 Main",
          billingCity: "Dallas",
          billingState: "TX",
          billingPostalCode: "75001",
          qboCustomerId: "qbo-cust-1",
        }),
      })
    );
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();

    // Should return updated action
    expect(result).toEqual({ success: true, action: "updated" });

    // Should log with fieldsUpdated metadata
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "customer",
          entityId: mockExistingCustomer.id,
          action: "pull",
          status: "success",
          metadata: expect.objectContaining({ fieldsUpdated: expect.any(Array) }),
        }),
      })
    );
  });

  it("falls back to email match when QBO ID not found", async () => {
    // First findFirst (by qboCustomerId) returns null
    mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
    // Second findFirst (by primaryEmail) returns existing customer without qboCustomerId
    const customerWithoutQboId = { ...mockExistingCustomer, qboCustomerId: null };
    mockPrisma.customer.findFirst.mockResolvedValueOnce(customerWithoutQboId);

    const result = await processInboundCustomer("org-1", mockQboCustomer, "conn-1");

    // Should update (not create)
    expect(mockPrisma.customer.update).toHaveBeenCalled();
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();

    // Update data must include qboCustomerId to link the record
    const updateCall = mockPrisma.customer.update.mock.calls[0][0];
    expect(updateCall.data.qboCustomerId).toBe("qbo-cust-1");

    expect(result.action).toBe("updated");
  });

  it("creates new customer when not found by QBO ID or email", async () => {
    // Both findFirst calls return null
    mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
    mockPrisma.customer.findFirst.mockResolvedValueOnce(null);

    const result = await processInboundCustomer("org-1", mockQboCustomer, "conn-1");

    // Should create with orgId, qboCustomerId, and mapped fields
    expect(mockPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          qboCustomerId: "qbo-cust-1",
          name: "Acme Corp",
          primaryEmail: "billing@acme.com",
        }),
      })
    );
    expect(mockPrisma.customer.update).not.toHaveBeenCalled();

    expect(result).toEqual({ success: true, action: "created" });

    // Should log with action: "created_inbound" in metadata
    expect(mockPrisma.qboSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ action: "created_inbound" }),
        }),
      })
    );
  });

  it("does not propagate QBO Active=false to ServiceOps status", async () => {
    const inactiveQboCustomer = { ...mockQboCustomer, Active: false };

    // findFirst by qboCustomerId returns existing customer
    mockPrisma.customer.findFirst.mockResolvedValueOnce(mockExistingCustomer);

    await processInboundCustomer("org-1", inactiveQboCustomer, "conn-1");

    // Update data must NOT include a status field (ServiceOps wins on status)
    const updateCall = mockPrisma.customer.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("status");
  });
});

// ============================================
// processCdcCustomerPull
// ============================================

describe("processCdcCustomerPull", () => {
  let processCdcCustomerPull: typeof import("@/lib/qbo/qbo-sync").processCdcCustomerPull;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    processCdcCustomerPull = mod.processCdcCustomerPull;
  });

  it("fetches QBO customer then delegates to processInboundCustomer", async () => {
    // Connection lookup
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(mockConnection);
    // getCustomer returns the QBO customer
    mockClient.getCustomer.mockResolvedValueOnce(mockQboCustomer);
    // processInboundCustomer internal: findFirst by qboCustomerId returns existing
    mockPrisma.customer.findFirst.mockResolvedValueOnce(mockExistingCustomer);

    const result = await processCdcCustomerPull("org-1", "qbo-cust-1", "realm-1");

    // getCustomer should be called with connection and the QBO customer ID
    expect(mockClient.getCustomer).toHaveBeenCalledWith(mockConnection, "qbo-cust-1");

    // Delegation worked — customer was updated
    expect(mockPrisma.customer.update).toHaveBeenCalled();

    expect(result.success).toBe(true);
  });
});
