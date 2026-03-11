import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    qboConnection: { findMany: vi.fn(), update: vi.fn() },
    qboSyncLog: { create: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/qbo/qbo-client", () => ({
  refreshAccessToken: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/qbo/qbo-client";
import { sendEmail } from "@/lib/email";

describe("qbo-token-check cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.CRON_SECRET = "test-secret";
    (prisma.qboSyncLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { email: "admin@test.com", name: "Admin" },
    ]);
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  async function callCron(authHeader?: string) {
    const { GET } = await import("@/app/api/cron/qbo-token-check/route");
    const headers = new Headers();
    if (authHeader) headers.set("authorization", authHeader);
    const req = new Request("http://localhost/api/cron/qbo-token-check", {
      headers,
    });
    return GET(req as any);
  }

  it("returns 401 without CRON_SECRET", async () => {
    const res = await callCron();
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong CRON_SECRET", async () => {
    const res = await callCron("Bearer wrong-secret");
    expect(res.status).toBe(401);
  });

  it("skips connections with token expiry > 14 days", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days out
    (prisma.qboConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "conn-1",
        orgId: "org-1",
        refreshTokenExpiry: futureDate,
        org: { id: "org-1", name: "Test Org" },
      },
    ]);

    const res = await callCron("Bearer test-secret");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results[0].action).toBe("healthy");
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("proactively refreshes tokens expiring within 14 days", async () => {
    const soonDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days out
    (prisma.qboConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "conn-1",
        orgId: "org-1",
        refreshTokenExpiry: soonDate,
        org: { id: "org-1", name: "Test Org" },
      },
    ]);
    (refreshAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 3600,
    });
    (prisma.qboConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await callCron("Bearer test-secret");
    const data = await res.json();

    expect(refreshAccessToken).toHaveBeenCalled();
    expect(prisma.qboConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessToken: "new-access",
          refreshToken: "new-refresh",
        }),
      })
    );
    expect(data.results[0].action).toBe("refreshed");
  });

  it("deactivates connection and sends email on invalid_grant", async () => {
    const expiredDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    (prisma.qboConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "conn-1",
        orgId: "org-1",
        refreshTokenExpiry: expiredDate,
        companyName: "Test Corp",
        org: { id: "org-1", name: "Test Org" },
      },
    ]);
    (refreshAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("invalid_grant")
    );
    (prisma.qboConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await callCron("Bearer test-secret");
    const data = await res.json();

    expect(prisma.qboConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@test.com",
        subject: expect.stringContaining("QBO Connection Lost"),
      })
    );
    expect(data.results[0].action).toBe("deactivated");
  });

  it("processes multiple orgs with per-org error isolation", async () => {
    const soonDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    (prisma.qboConnection.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "conn-1",
        orgId: "org-1",
        refreshTokenExpiry: soonDate,
        org: { id: "org-1", name: "Org 1" },
      },
      {
        id: "conn-2",
        orgId: "org-2",
        refreshTokenExpiry: soonDate,
        org: { id: "org-2", name: "Org 2" },
      },
    ]);
    (refreshAccessToken as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("invalid_grant"))
      .mockResolvedValueOnce({
        accessToken: "new",
        refreshToken: "new",
        expiresIn: 3600,
      });
    (prisma.qboConnection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await callCron("Bearer test-secret");
    const data = await res.json();

    expect(data.processed).toBe(2);
    expect(data.results[0].action).toBe("deactivated");
    expect(data.results[1].action).toBe("refreshed");
  });
});
