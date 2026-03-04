import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMockPrisma } from "../helpers/mock-prisma";
import {
  createAuthenticatedRequest,
  createUnauthenticatedRequest,
} from "../helpers/mock-auth";
import { makeInvoice } from "../helpers/test-data";

import { GET, POST } from "@/app/api/invoices/route";
import {
  GET as GET_BY_ID,
  PATCH,
} from "@/app/api/invoices/[id]/route";

const mockPrisma = getMockPrisma();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/invoices", () => {
  it("returns 401 when unauthenticated", async () => {
    const req = createUnauthenticatedRequest("http://localhost/api/invoices");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns invoices scoped to org", async () => {
    const invoices = [makeInvoice()];
    mockPrisma.invoice.findMany.mockResolvedValue(invoices as any);

    const req = createAuthenticatedRequest("http://localhost/api/invoices");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-1" }),
      })
    );
  });
});

describe("POST /api/invoices", () => {
  it("returns 400 when required fields missing", async () => {
    const req = createAuthenticatedRequest("http://localhost/api/invoices", {
      method: "POST",
      body: { description: "no customer or title" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates invoice with DRAFT status", async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(null); // no prior invoices
    mockPrisma.invoice.create.mockResolvedValue(invoice as any);

    const req = createAuthenticatedRequest("http://localhost/api/invoices", {
      method: "POST",
      body: {
        customerId: "cust-1",
        title: "Pump Repair Invoice",
      },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.id).toBe("inv-1");
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          status: "DRAFT",
        }),
      })
    );
  });
});

describe("GET /api/invoices/[id]", () => {
  it("returns 404 when invoice not found", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    const req = createAuthenticatedRequest("http://localhost/api/invoices/nonexistent");
    const res = await GET_BY_ID(req as any, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns invoice with related data", async () => {
    const invoice = {
      ...makeInvoice(),
      customer: { id: "cust-1", name: "Acme" },
      site: null,
      workOrder: null,
      quote: null,
      createdBy: { name: "Test", email: "test@test.com" },
      lineItems: [],
    };
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice as any);

    const req = createAuthenticatedRequest("http://localhost/api/invoices/inv-1");
    const res = await GET_BY_ID(req as any, {
      params: Promise.resolve({ id: "inv-1" }),
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.id).toBe("inv-1");
  });
});

describe("PATCH /api/invoices/[id]", () => {
  it("sets paidAt when status becomes PAID", async () => {
    const invoice = makeInvoice({ status: "SENT", paidAt: null });
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice as any);
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      status: "PAID",
      paidAt: new Date(),
    } as any);

    const req = createAuthenticatedRequest("http://localhost/api/invoices/inv-1", {
      method: "PATCH",
      body: { status: "PAID" },
    });

    const res = await PATCH(req as any, {
      params: Promise.resolve({ id: "inv-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAID",
          paidAt: expect.any(Date),
        }),
      })
    );
  });

  it("only allows content edits on DRAFT invoices", async () => {
    // SENT invoice should NOT get title updated
    const invoice = makeInvoice({ status: "SENT" });
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice as any);
    mockPrisma.invoice.update.mockResolvedValue(invoice as any);

    const req = createAuthenticatedRequest("http://localhost/api/invoices/inv-1", {
      method: "PATCH",
      body: { title: "New Title" },
    });

    const res = await PATCH(req as any, {
      params: Promise.resolve({ id: "inv-1" }),
    });

    // It should succeed but not include the title in the update
    expect(res.status).toBe(200);
    const updateCall = mockPrisma.invoice.update.mock.calls[0][0];
    expect(updateCall.data.title).toBeUndefined();
  });
});
