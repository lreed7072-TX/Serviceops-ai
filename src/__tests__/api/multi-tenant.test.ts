import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMockPrisma } from "../helpers/mock-prisma";
import { makeWorkOrder } from "../helpers/test-data";
import { requireAuthSessionFirst } from "@/lib/auth";

import { GET as GET_WORK_ORDERS } from "@/app/api/work-orders/route";
import { GET as GET_CUSTOMERS } from "@/app/api/customers/route";
import { GET as GET_QUOTES } from "@/app/api/quotes/route";
import { GET as GET_INVOICES } from "@/app/api/invoices/route";

const mockPrisma = getMockPrisma();
const mockedAuth = vi.mocked(requireAuthSessionFirst);

function mockAuthForOrg(orgId: string, userId = "user-1", role = "ADMIN" as const) {
  mockedAuth.mockResolvedValueOnce({
    auth: { orgId, userId, role },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Multi-tenant isolation", () => {
  it("work orders query includes orgId filter", async () => {
    mockAuthForOrg("org-alpha");
    mockPrisma.workOrder.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/work-orders");
    await GET_WORK_ORDERS(req);

    expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-alpha" }),
      })
    );
  });

  it("customers query includes orgId filter", async () => {
    mockAuthForOrg("org-beta");
    mockPrisma.customer.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/customers");
    await GET_CUSTOMERS(req);

    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-beta" }),
      })
    );
  });

  it("quotes query includes orgId filter", async () => {
    mockAuthForOrg("org-gamma");
    mockPrisma.quote.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/quotes");
    await GET_QUOTES(req);

    expect(mockPrisma.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-gamma" }),
      })
    );
  });

  it("invoices query includes orgId filter", async () => {
    mockAuthForOrg("org-delta");
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/invoices");
    await GET_INVOICES(req);

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-delta" }),
      })
    );
  });

  it("different orgs get different results", async () => {
    const orgAData = [makeWorkOrder({ orgId: "org-A", title: "Org A WO" })];
    const orgBData = [makeWorkOrder({ orgId: "org-B", title: "Org B WO" })];

    // First call for org-A
    mockAuthForOrg("org-A", "user-a");
    mockPrisma.workOrder.findMany.mockResolvedValueOnce(orgAData as any);
    const reqA = new Request("http://localhost/api/work-orders");
    const resA = await GET_WORK_ORDERS(reqA);
    const jsonA = await resA.json();

    // Second call for org-B
    mockAuthForOrg("org-B", "user-b");
    mockPrisma.workOrder.findMany.mockResolvedValueOnce(orgBData as any);
    const reqB = new Request("http://localhost/api/work-orders");
    const resB = await GET_WORK_ORDERS(reqB);
    const jsonB = await resB.json();

    // Verify each org gets only its data
    expect(jsonA.data[0].title).toBe("Org A WO");
    expect(jsonB.data[0].title).toBe("Org B WO");

    // Verify the calls were made with correct orgIds
    const calls = mockPrisma.workOrder.findMany.mock.calls;
    expect(calls[0][0].where.orgId).toBe("org-A");
    expect(calls[1][0].where.orgId).toBe("org-B");
  });
});
