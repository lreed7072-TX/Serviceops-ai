import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCK SETUP
// ============================================

const mockPrisma = {
  qboConnection: { findFirst: vi.fn(), update: vi.fn() },
  qboClassMap: { findUnique: vi.fn(), upsert: vi.fn() },
  qboSyncLog: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockCreateClass = vi.fn();
const mockGetPreferences = vi.fn();

vi.mock("@/lib/qbo/qbo-client", () => ({
  createClass: mockCreateClass,
  getPreferences: mockGetPreferences,
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
  queryEntities: vi.fn(),
  queryClasses: vi.fn(),
  getValidAccessToken: vi.fn(),
  createEmployee: vi.fn(),
  getEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  createVendor: vi.fn(),
  getVendor: vi.fn(),
  updateVendor: vi.fn(),
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
  classTrackingEnabled: true,
  locationTrackingEnabled: false,
  preferencesLastCheckedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// resolveOrCreateQboClass
// ============================================

describe("resolveOrCreateQboClass", () => {
  let resolveOrCreateQboClass: typeof import("@/lib/qbo/qbo-sync").resolveOrCreateQboClass;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    resolveOrCreateQboClass = mod.resolveOrCreateQboClass;
  });

  it("returns null when classTrackingEnabled is false", async () => {
    const connDisabled = { ...mockConnection, classTrackingEnabled: false };

    const result = await resolveOrCreateQboClass(connDisabled as any, "org-1", "WORK_ORDER");

    expect(result).toBeNull();
    expect(mockPrisma.qboClassMap.findUnique).not.toHaveBeenCalled();
    expect(mockCreateClass).not.toHaveBeenCalled();
  });

  it("returns null when classTrackingEnabled is null", async () => {
    const connNull = { ...mockConnection, classTrackingEnabled: null };

    const result = await resolveOrCreateQboClass(connNull as any, "org-1", "WORK_ORDER");

    expect(result).toBeNull();
    expect(mockCreateClass).not.toHaveBeenCalled();
  });

  it("returns cached ClassRef from QboClassMap", async () => {
    mockPrisma.qboClassMap.findUnique.mockResolvedValueOnce({
      orgId: "org-1",
      orderType: "WORK_ORDER",
      qboClassId: "cls-cached",
      qboClassName: "Work Order",
    });

    const result = await resolveOrCreateQboClass(mockConnection as any, "org-1", "WORK_ORDER");

    expect(result).toEqual({ value: "cls-cached", name: "Work Order" });
    expect(mockCreateClass).not.toHaveBeenCalled();
  });

  it("auto-creates Class and caches", async () => {
    // No cache hit
    mockPrisma.qboClassMap.findUnique.mockResolvedValueOnce(null);

    // createClass returns
    mockCreateClass.mockResolvedValueOnce({ Id: "cls-new", Name: "Work Order" });

    const result = await resolveOrCreateQboClass(mockConnection as any, "org-1", "WORK_ORDER");

    expect(result).toEqual({ value: "cls-new", name: "Work Order" });
    expect(mockCreateClass).toHaveBeenCalledWith(mockConnection, { Name: "Work Order" });

    // Should cache via upsert
    expect(mockPrisma.qboClassMap.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId_orderType: { orgId: "org-1", orderType: "WORK_ORDER" } },
        create: expect.objectContaining({
          orgId: "org-1",
          orderType: "WORK_ORDER",
          qboClassId: "cls-new",
          qboClassName: "Work Order",
        }),
        update: expect.objectContaining({
          qboClassId: "cls-new",
          qboClassName: "Work Order",
        }),
      })
    );
  });

  it("returns null on createClass error (never blocks sync)", async () => {
    mockPrisma.qboClassMap.findUnique.mockResolvedValueOnce(null);
    mockCreateClass.mockRejectedValueOnce(new Error("QBO API timeout"));

    const result = await resolveOrCreateQboClass(mockConnection as any, "org-1", "PROJECT");

    expect(result).toBeNull();
    // Should NOT throw — class failures must never block syncs
  });
});

// ============================================
// fetchAndCachePreferences
// ============================================

describe("fetchAndCachePreferences", () => {
  let fetchAndCachePreferences: typeof import("@/lib/qbo/qbo-sync").fetchAndCachePreferences;

  beforeEach(async () => {
    const mod = await import("@/lib/qbo/qbo-sync");
    fetchAndCachePreferences = mod.fetchAndCachePreferences;
  });

  it("extracts class and location flags", async () => {
    mockGetPreferences.mockResolvedValueOnce({
      AccountingInfoPrefs: {
        ClassTrackingPerTxn: true,
        ClassTrackingPerTxnLine: false,
        TrackDepartments: false,
      },
    });

    const result = await fetchAndCachePreferences(mockConnection as any);

    expect(result.classTrackingEnabled).toBe(true);
    expect(result.locationTrackingEnabled).toBe(false);

    expect(mockPrisma.qboConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conn-1" },
        data: expect.objectContaining({
          classTrackingEnabled: true,
          locationTrackingEnabled: false,
        }),
      })
    );
  });

  it("updates QboConnection with preferences", async () => {
    mockGetPreferences.mockResolvedValueOnce({
      AccountingInfoPrefs: {
        ClassTrackingPerTxn: false,
        ClassTrackingPerTxnLine: false,
        TrackDepartments: true,
      },
    });

    const result = await fetchAndCachePreferences(mockConnection as any);

    expect(result.classTrackingEnabled).toBe(false);
    expect(result.locationTrackingEnabled).toBe(true);

    expect(mockPrisma.qboConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classTrackingEnabled: false,
          locationTrackingEnabled: true,
          preferencesLastCheckedAt: expect.any(Date),
        }),
      })
    );
  });

  it("handles line-level class tracking", async () => {
    mockGetPreferences.mockResolvedValueOnce({
      AccountingInfoPrefs: {
        ClassTrackingPerTxn: false,
        ClassTrackingPerTxnLine: true,
        TrackDepartments: false,
      },
    });

    const result = await fetchAndCachePreferences(mockConnection as any);

    // ClassTrackingPerTxnLine=true should enable class tracking
    expect(result.classTrackingEnabled).toBe(true);
  });
});
