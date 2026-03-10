import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboConnection: { findFirst: vi.fn(), update: vi.fn() },
  vendor: { findFirst: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn(), update: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockCreateVendor = vi.fn();
const mockGetVendor = vi.fn();
const mockUpdateVendor = vi.fn();
const mockCreateEmployee = vi.fn();
const mockGetEmployee = vi.fn();
const mockUpdateEmployee = vi.fn();
const mockQueryEntities = vi.fn();
const mockGetValidAccessToken = vi.fn();

vi.mock("@/lib/qbo/qbo-client", () => ({
  createVendor: mockCreateVendor,
  getVendor: mockGetVendor,
  updateVendor: mockUpdateVendor,
  createEmployee: mockCreateEmployee,
  getEmployee: mockGetEmployee,
  updateEmployee: mockUpdateEmployee,
  queryEntities: mockQueryEntities,
  getValidAccessToken: mockGetValidAccessToken,
  // Stubs for other imports qbo-sync pulls in
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
  createTimeActivity: vi.fn(),
  createBill: vi.fn(),
  createPurchase: vi.fn(),
  createCreditMemo: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// syncVendorToQbo
// ============================================

describe("syncVendorToQbo", () => {
  let syncVendorToQbo: typeof import("@/lib/qbo/qbo-sync").syncVendorToQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    syncVendorToQbo = mod.syncVendorToQbo;
  });

  it("creates new QBO Vendor when no qboVendorId", async () => {
    mockActiveConnection();

    mockPrisma.vendor.findFirst.mockResolvedValueOnce({
      id: "vend-1",
      orgId: "org-1",
      name: "FlowServe Parts",
      companyName: "FlowServe",
      email: "parts@flowserve.com",
      phone: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      tax1099: false,
      qboVendorId: null,
    });

    // No collision
    mockQueryEntities.mockResolvedValueOnce([]);

    // createVendor returns
    mockCreateVendor.mockResolvedValueOnce({ Id: "qbo-vend-1", DisplayName: "FlowServe Parts" });

    const result = await syncVendorToQbo("org-1", "vend-1");

    expect(result.success).toBe(true);
    expect(result.qboVendorId).toBe("qbo-vend-1");

    // Should store the qboVendorId on vendor
    expect(mockPrisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vend-1" },
        data: expect.objectContaining({ qboVendorId: "qbo-vend-1" }),
      })
    );
  });

  it("updates existing QBO Vendor when qboVendorId present", async () => {
    mockActiveConnection();

    mockPrisma.vendor.findFirst.mockResolvedValueOnce({
      id: "vend-2",
      orgId: "org-1",
      name: "Updated Parts Co",
      tax1099: true,
      qboVendorId: "existing-qbo-vend",
    });

    mockGetVendor.mockResolvedValueOnce({
      Id: "existing-qbo-vend",
      SyncToken: "3",
      DisplayName: "Old Parts Co",
    });

    mockUpdateVendor.mockResolvedValueOnce({
      Id: "existing-qbo-vend",
      SyncToken: "4",
      DisplayName: "Updated Parts Co",
    });

    const result = await syncVendorToQbo("org-1", "vend-2");

    expect(result.success).toBe(true);
    expect(mockGetVendor).toHaveBeenCalledWith(mockConnection, "existing-qbo-vend");
    expect(mockUpdateVendor).toHaveBeenCalled();
    expect(mockCreateVendor).not.toHaveBeenCalled();
  });

  it("returns error when vendor not found", async () => {
    mockActiveConnection();
    mockPrisma.vendor.findFirst.mockResolvedValueOnce(null);

    const result = await syncVendorToQbo("org-1", "vend-missing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Vendor not found");
  });

  it("returns error when no active QBO connection", async () => {
    mockPrisma.qboConnection.findFirst.mockResolvedValueOnce(null);

    const result = await syncVendorToQbo("org-1", "vend-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No active QBO connection");
  });
});

// ============================================
// syncEmployeeToQbo
// ============================================

describe("syncEmployeeToQbo", () => {
  let syncEmployeeToQbo: typeof import("@/lib/qbo/qbo-sync").syncEmployeeToQbo;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    syncEmployeeToQbo = mod.syncEmployeeToQbo;
  });

  it("creates QBO Employee for TECH user", async () => {
    mockActiveConnection();

    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user-1",
      orgId: "org-1",
      name: "Mike Technician",
      email: "mike@gps.com",
      role: "TECH",
      qboEmployeeId: null,
    });

    // No collision
    mockQueryEntities.mockResolvedValueOnce([]);

    mockCreateEmployee.mockResolvedValueOnce({ Id: "qbo-emp-1", DisplayName: "Mike Technician" });

    const result = await syncEmployeeToQbo("org-1", "user-1");

    expect(result.success).toBe(true);
    expect(result.qboEmployeeId).toBe("qbo-emp-1");

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ qboEmployeeId: "qbo-emp-1" }),
      })
    );
  });

  it("rejects non-TECH user", async () => {
    mockActiveConnection();

    // findFirst with role: "TECH" filter will return null for ADMIN user
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const result = await syncEmployeeToQbo("org-1", "user-admin");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found or not a TECH");
  });

  it("updates existing when qboEmployeeId present", async () => {
    mockActiveConnection();

    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "user-2",
      orgId: "org-1",
      name: "Updated Tech",
      email: "tech@gps.com",
      role: "TECH",
      qboEmployeeId: "existing-emp-1",
    });

    mockGetEmployee.mockResolvedValueOnce({
      Id: "existing-emp-1",
      SyncToken: "1",
      DisplayName: "Old Tech",
    });

    mockUpdateEmployee.mockResolvedValueOnce({
      Id: "existing-emp-1",
      SyncToken: "2",
      DisplayName: "Updated Tech",
    });

    const result = await syncEmployeeToQbo("org-1", "user-2");

    expect(result.success).toBe(true);
    expect(mockGetEmployee).toHaveBeenCalledWith(mockConnection, "existing-emp-1");
    expect(mockUpdateEmployee).toHaveBeenCalled();
    expect(mockCreateEmployee).not.toHaveBeenCalled();
  });

  it("returns error when user not found", async () => {
    mockActiveConnection();
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const result = await syncEmployeeToQbo("org-1", "user-missing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});
