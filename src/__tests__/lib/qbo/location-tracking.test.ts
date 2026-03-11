import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    qboLocationMap: { findUnique: vi.fn(), upsert: vi.fn() },
    site: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/qbo/qbo-client", () => ({
  createLocation: vi.fn(),
  queryLocations: vi.fn(),
  getValidAccessToken: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createLocation } from "@/lib/qbo/qbo-client";
import { resolveOrCreateQboLocation } from "@/lib/qbo/qbo-sync";

describe("resolveOrCreateQboLocation", () => {
  const mockConnection = {
    id: "conn-1",
    orgId: "org-1",
    realmId: "realm-1",
    accessToken: "token",
    refreshToken: "refresh",
    isActive: true,
    classTrackingEnabled: false,
    locationTrackingEnabled: true,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.site.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Acme Plant 3",
    });
    (prisma.qboLocationMap.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("returns null when siteId is null", async () => {
    const result = await resolveOrCreateQboLocation(mockConnection, "org-1", null);
    expect(result).toBeNull();
  });

  it("returns null when siteId is undefined", async () => {
    const result = await resolveOrCreateQboLocation(mockConnection, "org-1", undefined);
    expect(result).toBeNull();
  });

  it("returns null when locationTrackingEnabled is false", async () => {
    const conn = { ...mockConnection, locationTrackingEnabled: false };
    const result = await resolveOrCreateQboLocation(conn, "org-1", "site-1");
    expect(result).toBeNull();
    expect(prisma.qboLocationMap.findUnique).not.toHaveBeenCalled();
  });

  it("returns cached QboRef when QboLocationMap exists", async () => {
    (prisma.qboLocationMap.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      qboLocationId: "qbo-loc-1",
      qboLocationName: "Acme Plant 3",
    });

    const result = await resolveOrCreateQboLocation(mockConnection, "org-1", "site-1");
    expect(result).toEqual({ value: "qbo-loc-1", name: "Acme Plant 3" });
    expect(createLocation).not.toHaveBeenCalled();
  });

  it("auto-creates QBO Department when not cached", async () => {
    (prisma.qboLocationMap.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createLocation as ReturnType<typeof vi.fn>).mockResolvedValue({
      Id: "qbo-loc-new",
      Name: "Acme Plant 3",
    });

    const result = await resolveOrCreateQboLocation(mockConnection, "org-1", "site-1");
    expect(result).toEqual({ value: "qbo-loc-new", name: "Acme Plant 3" });
    expect(createLocation).toHaveBeenCalledWith(mockConnection, { Name: "Acme Plant 3" });
  });

  it("caches mapping after auto-create via upsert", async () => {
    (prisma.qboLocationMap.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createLocation as ReturnType<typeof vi.fn>).mockResolvedValue({
      Id: "qbo-loc-new",
      Name: "Acme Plant 3",
    });

    await resolveOrCreateQboLocation(mockConnection, "org-1", "site-1");
    expect(prisma.qboLocationMap.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId_siteId: { orgId: "org-1", siteId: "site-1" } },
        create: expect.objectContaining({ qboLocationId: "qbo-loc-new" }),
      })
    );
  });

  it("returns null on error - never blocks sync", async () => {
    (prisma.qboLocationMap.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB error")
    );
    const result = await resolveOrCreateQboLocation(mockConnection, "org-1", "site-1");
    expect(result).toBeNull();
  });
});
