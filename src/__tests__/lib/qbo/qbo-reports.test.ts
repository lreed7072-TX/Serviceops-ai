import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireAuthSessionFirst: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    qboConnection: { findFirst: vi.fn() },
  },
}));

// Mock QBO client
vi.mock("@/lib/qbo/qbo-client", () => ({
  runReport: vi.fn(),
}));

import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runReport } from "@/lib/qbo/qbo-client";

describe("QBO Reports Normalization", () => {
  const mockAuth = { orgId: "org-1", userId: "user-1", role: "ADMIN" };
  const mockConnection = { id: "conn-1", orgId: "org-1", isActive: true };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    (requireAuthSessionFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: mockAuth,
    });
    (prisma.qboConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockConnection
    );
  });

  it("runReport is called with correct params for P&L", async () => {
    (runReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      Header: {
        ReportName: "ProfitAndLoss",
        StartPeriod: "2026-01-01",
        EndPeriod: "2026-03-31",
      },
      Columns: { Column: [] },
      Rows: { Row: [] },
    });

    const { GET } = await import("@/app/api/integrations/qbo/reports/route");
    const url =
      "http://localhost/api/integrations/qbo/reports?report=ProfitAndLoss&start_date=2026-01-01&end_date=2026-03-31&accounting_method=Cash";
    const req = new Request(url);
    const res = await GET(req as any);

    expect(runReport).toHaveBeenCalledWith(
      mockConnection,
      "ProfitAndLoss",
      expect.objectContaining({
        start_date: "2026-01-01",
        end_date: "2026-03-31",
        accounting_method: "Cash",
      })
    );
    expect(res.status).toBe(200);
  });

  it("normalizes P&L sections with items and totals", async () => {
    (runReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      Header: {
        ReportName: "ProfitAndLoss",
        StartPeriod: "2026-01-01",
        EndPeriod: "2026-03-31",
      },
      Columns: {
        Column: [
          { ColTitle: "", ColType: "Account" },
          { ColTitle: "Total", ColType: "Money" },
        ],
      },
      Rows: {
        Row: [
          {
            type: "Section",
            Header: { ColData: [{ value: "Income" }] },
            Rows: {
              Row: [
                {
                  type: "Data",
                  ColData: [{ value: "Service Revenue" }, { value: "5000.00" }],
                },
                {
                  type: "Data",
                  ColData: [{ value: "Product Sales" }, { value: "3000.00" }],
                },
              ],
            },
            Summary: {
              ColData: [{ value: "Total Income" }, { value: "8000.00" }],
            },
          },
        ],
      },
    });

    const { GET } = await import("@/app/api/integrations/qbo/reports/route");
    const url =
      "http://localhost/api/integrations/qbo/reports?report=ProfitAndLoss&start_date=2026-01-01&end_date=2026-03-31";
    const req = new Request(url);
    const res = await GET(req as any);
    const { data } = await res.json();

    expect(data.sections).toHaveLength(1);
    expect(data.sections[0].name).toBe("Income");
    expect(data.sections[0].total).toBe(8000);
    expect(data.sections[0].items).toHaveLength(2);
    expect(data.sections[0].items[0]).toEqual({
      name: "Service Revenue",
      value: 5000,
    });
  });

  it("handles empty report rows gracefully", async () => {
    (runReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      Header: {
        ReportName: "BalanceSheet",
        StartPeriod: "2026-01-01",
        EndPeriod: "2026-03-31",
      },
      Columns: { Column: [] },
      Rows: { Row: [] },
    });

    const { GET } = await import("@/app/api/integrations/qbo/reports/route");
    const url =
      "http://localhost/api/integrations/qbo/reports?report=BalanceSheet&start_date=2026-01-01&end_date=2026-03-31";
    const req = new Request(url);
    const res = await GET(req as any);
    const { data } = await res.json();

    expect(data.sections).toHaveLength(0);
    expect(res.status).toBe(200);
  });

  it("rejects invalid report name", async () => {
    const { GET } = await import("@/app/api/integrations/qbo/reports/route");
    const url =
      "http://localhost/api/integrations/qbo/reports?report=InvalidReport&start_date=2026-01-01&end_date=2026-03-31";
    const req = new Request(url);
    const res = await GET(req as any);

    expect(res.status).toBe(400);
  });

  it("requires start_date and end_date", async () => {
    const { GET } = await import("@/app/api/integrations/qbo/reports/route");
    const url =
      "http://localhost/api/integrations/qbo/reports?report=ProfitAndLoss";
    const req = new Request(url);
    const res = await GET(req as any);

    expect(res.status).toBe(400);
  });

  it("returns 404 when no active QBO connection", async () => {
    (prisma.qboConnection.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("@/app/api/integrations/qbo/reports/route");
    const url =
      "http://localhost/api/integrations/qbo/reports?report=ProfitAndLoss&start_date=2026-01-01&end_date=2026-03-31";
    const req = new Request(url);
    const res = await GET(req as any);

    expect(res.status).toBe(404);
  });
});
