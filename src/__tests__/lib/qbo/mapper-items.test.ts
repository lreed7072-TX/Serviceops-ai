import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma (needed because qbo-sync imports it)
const mockPrisma = {
  qboConnection: { findFirst: vi.fn() },
  qboAccountMap: { findMany: vi.fn(), findUnique: vi.fn() },
  material: { findFirst: vi.fn(), update: vi.fn() },
  laborRate: { findFirst: vi.fn(), update: vi.fn() },
  customer: { findFirst: vi.fn(), update: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Mock qbo-client (needed because qbo-sync imports it)
const mockQueryEntities = vi.fn();
const mockCreateCustomer = vi.fn();
const mockUpdateCustomer = vi.fn();
const mockGetValidAccessToken = vi.fn();
const mockCreateItem = vi.fn();
const mockGetItem = vi.fn();
const mockUpdateItem = vi.fn();
const mockCreateEstimate = vi.fn();
const mockGetPayment = vi.fn();
const mockGetInvoice = vi.fn();
const mockCreateInvoice = vi.fn();
const mockGetCustomer = vi.fn();

vi.mock("@/lib/qbo/qbo-client", () => ({
  queryEntities: mockQueryEntities,
  createCustomer: mockCreateCustomer,
  updateCustomer: mockUpdateCustomer,
  getValidAccessToken: mockGetValidAccessToken,
  createItem: mockCreateItem,
  getItem: mockGetItem,
  updateItem: mockUpdateItem,
  createEstimate: mockCreateEstimate,
  getPayment: mockGetPayment,
  getInvoice: mockGetInvoice,
  createInvoice: mockCreateInvoice,
  getCustomer: mockGetCustomer,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// toQboItem — pure mapper tests (no mocking needed)
// ============================================

describe("toQboItem", () => {
  let toQboItem: typeof import("@/lib/qbo/qbo-mapper").toQboItem;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-mapper");
    toQboItem = mod.toQboItem;
  });

  it("creates NonInventory item from material", () => {
    const result = toQboItem(
      { name: "Pump Seal Kit", description: "Mechanical seal", unitCost: 125.5 },
      "NonInventory",
      { value: "income-acct-1", name: "Materials Income" }
    );
    expect(result.Name).toBe("Pump Seal Kit");
    expect(result.Type).toBe("NonInventory");
    expect(result.IncomeAccountRef).toEqual({
      value: "income-acct-1",
      name: "Materials Income",
    });
    expect(result.UnitPrice).toBe(125.5);
    expect(result.Description).toBe("Mechanical seal");
  });

  it("creates Service item from labor rate", () => {
    const result = toQboItem(
      { name: "Standard Labor", description: "Field tech hourly rate", hourlyRate: 95.0 },
      "Service",
      { value: "income-acct-2", name: "Labor Income" }
    );
    expect(result.Name).toBe("Standard Labor");
    expect(result.Type).toBe("Service");
    expect(result.UnitPrice).toBe(95.0);
  });

  it("merges with existing QBO item on update", () => {
    const existing = {
      Id: "qbo-123",
      SyncToken: "5",
      Name: "Old Name",
      Type: "NonInventory" as const,
      Active: true,
      Taxable: true,
    };
    const result = toQboItem(
      { name: "New Name", unitCost: 50 },
      "NonInventory",
      { value: "acct-1" },
      existing as any
    );
    expect(result.Name).toBe("New Name"); // Overridden
    expect(result.Id).toBe("qbo-123"); // Preserved from existing
    expect(result.SyncToken).toBe("5"); // Preserved
    expect(result.Taxable).toBe(true); // Preserved
  });

  it("handles null/undefined unitCost gracefully", () => {
    const result = toQboItem(
      { name: "No Price Item" },
      "NonInventory",
      { value: "acct-1" }
    );
    expect(result.Name).toBe("No Price Item");
    expect(result.UnitPrice).toBeUndefined();
  });

  it("rounds unitCost to 2 decimal places", () => {
    const result = toQboItem(
      { name: "Precise Item", unitCost: 99.999 },
      "NonInventory",
      { value: "acct-1" }
    );
    expect(result.UnitPrice).toBe(100.0);
  });

  it("uses hourlyRate for Service type items", () => {
    const result = toQboItem(
      { name: "Overtime Labor", hourlyRate: 142.5 },
      "Service",
      { value: "acct-2" }
    );
    expect(result.UnitPrice).toBe(142.5);
    expect(result.Type).toBe("Service");
  });

  it("does not set Description when source.description is null", () => {
    const result = toQboItem(
      { name: "No Desc Item", description: null },
      "NonInventory",
      { value: "acct-1" }
    );
    expect(result.Description).toBeUndefined();
  });
});

// ============================================
// resolveOrCreateQboEntity — collision handling tests
// ============================================

describe("resolveOrCreateQboEntity", () => {
  let resolveOrCreateQboEntity: typeof import("@/lib/qbo/qbo-sync").resolveOrCreateQboEntity;

  const mockConnection = {
    id: "conn-1",
    orgId: "org-1",
    realmId: "123456789",
    accessToken: "valid-token",
    refreshToken: "valid-refresh",
    accessTokenExpiry: new Date(Date.now() + 3600000),
    refreshTokenExpiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
    isActive: true,
    companyName: "Test Company",
    connectedAt: new Date(),
    lastSyncAt: null,
    refreshInProgress: false,
    refreshLockedAt: null,
  };

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    resolveOrCreateQboEntity = mod.resolveOrCreateQboEntity;
  });

  it("returns existing entity when matchFn returns true (link, don't duplicate)", async () => {
    const existingEntity = { Id: "qbo-existing-42", DisplayName: "Acme Corp", PrimaryEmailAddr: { Address: "acme@test.com" } };
    mockQueryEntities.mockResolvedValueOnce([existingEntity]);

    const createFn = vi.fn();

    const result = await resolveOrCreateQboEntity(
      mockConnection as any,
      "Customer",
      "Acme Corp",
      (existing: any) => existing.PrimaryEmailAddr?.Address === "acme@test.com",
      createFn
    );

    expect(result.entity).toBe(existingEntity);
    expect(result.wasExisting).toBe(true);
    expect(createFn).not.toHaveBeenCalled();
  });

  it("creates with suffix when collision exists but matchFn returns false", async () => {
    const existingEntity = { Id: "qbo-other", DisplayName: "Acme Corp", PrimaryEmailAddr: { Address: "other@test.com" } };
    mockQueryEntities.mockResolvedValueOnce([existingEntity]);

    const newEntity = { Id: "qbo-new-99", DisplayName: "Acme Corp (SvcOps)" };
    const createFn = vi.fn().mockResolvedValueOnce(newEntity);

    const result = await resolveOrCreateQboEntity(
      mockConnection as any,
      "Customer",
      "Acme Corp",
      () => false, // matchFn returns false — it's a collision, not a match
      createFn
    );

    expect(result.entity).toBe(newEntity);
    expect(result.wasExisting).toBe(false);
    expect(createFn).toHaveBeenCalledWith("Acme Corp (SvcOps)");
  });

  it("creates normally when no collision found", async () => {
    mockQueryEntities.mockResolvedValueOnce([]); // No existing entities

    const newEntity = { Id: "qbo-fresh-1", DisplayName: "New Customer" };
    const createFn = vi.fn().mockResolvedValueOnce(newEntity);

    const result = await resolveOrCreateQboEntity(
      mockConnection as any,
      "Customer",
      "New Customer",
      () => false,
      createFn
    );

    expect(result.entity).toBe(newEntity);
    expect(result.wasExisting).toBe(false);
    expect(createFn).toHaveBeenCalledWith("New Customer");
  });

  it("escapes single quotes in DisplayName for IQL query", async () => {
    mockQueryEntities.mockResolvedValueOnce([]);
    const createFn = vi.fn().mockResolvedValueOnce({ Id: "qbo-1" });

    await resolveOrCreateQboEntity(
      mockConnection as any,
      "Customer",
      "O'Brien's Pumps",
      () => false,
      createFn
    );

    // queryEntities should have been called with escaped name
    expect(mockQueryEntities).toHaveBeenCalledWith(
      mockConnection,
      expect.stringContaining("O\\'Brien\\'s Pumps"),
      "Customer"
    );
  });
});
