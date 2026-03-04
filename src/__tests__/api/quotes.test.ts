import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMockPrisma } from "../helpers/mock-prisma";
import {
  createAuthenticatedRequest,
  createUnauthenticatedRequest,
  mockForbiddenRole,
} from "../helpers/mock-auth";
import { makeQuote, makeCustomer } from "../helpers/test-data";

import { GET, POST } from "@/app/api/quotes/route";
import {
  GET as GET_BY_ID,
  PATCH,
  DELETE,
} from "@/app/api/quotes/[id]/route";
import { POST as ACCEPT_QUOTE } from "@/app/api/quotes/[id]/accept/route";

const mockPrisma = getMockPrisma();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/quotes", () => {
  it("returns 401 when unauthenticated", async () => {
    const req = createUnauthenticatedRequest("http://localhost/api/quotes");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns quotes scoped to org", async () => {
    const quotes = [makeQuote()];
    mockPrisma.quote.findMany.mockResolvedValue(quotes as any);

    const req = createAuthenticatedRequest("http://localhost/api/quotes");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(mockPrisma.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-1" }),
      })
    );
  });
});

describe("POST /api/quotes", () => {
  it("returns 403 when TECH tries to create", async () => {
    mockForbiddenRole("TECH");
    const req = createAuthenticatedRequest("http://localhost/api/quotes", {
      method: "POST",
      body: { customerId: "cust-1", title: "Test Quote" },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields missing", async () => {
    const req = createAuthenticatedRequest("http://localhost/api/quotes", {
      method: "POST",
      body: { description: "no customer or title" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates quote with DRAFT status", async () => {
    const customer = makeCustomer();
    const quote = makeQuote();

    mockPrisma.customer.findFirst.mockResolvedValue(customer as any);
    mockPrisma.quote.findFirst.mockResolvedValue(null); // no prior quotes
    mockPrisma.quote.create.mockResolvedValue(quote as any);

    const req = createAuthenticatedRequest("http://localhost/api/quotes", {
      method: "POST",
      body: {
        customerId: "cust-1",
        title: "Pump Repair Estimate",
      },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(mockPrisma.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          status: "DRAFT",
          customerId: "cust-1",
        }),
      })
    );
  });
});

describe("PATCH /api/quotes/[id]", () => {
  it("rejects content edits on non-DRAFT quotes", async () => {
    mockPrisma.quote.findFirst.mockResolvedValue(
      makeQuote({ status: "SENT" }) as any
    );

    const req = createAuthenticatedRequest("http://localhost/api/quotes/quote-1", {
      method: "PATCH",
      body: { title: "Updated title" },
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("DRAFT");
  });

  it("allows status transition from DRAFT to SENT", async () => {
    const quote = makeQuote({ status: "DRAFT" });
    mockPrisma.quote.findFirst.mockResolvedValue(quote as any);
    mockPrisma.quote.update.mockResolvedValue({ ...quote, status: "SENT" } as any);

    const req = createAuthenticatedRequest("http://localhost/api/quotes/quote-1", {
      method: "PATCH",
      body: { status: "SENT" },
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SENT",
          sentAt: expect.any(Date),
        }),
      })
    );
  });
});

describe("DELETE /api/quotes/[id]", () => {
  it("only allows deleting DRAFT quotes", async () => {
    mockPrisma.quote.findFirst.mockResolvedValue(
      makeQuote({ status: "SENT" }) as any
    );

    const req = createAuthenticatedRequest("http://localhost/api/quotes/quote-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("DRAFT");
  });

  it("deletes DRAFT quote successfully", async () => {
    mockPrisma.quote.findFirst.mockResolvedValue(makeQuote() as any);
    mockPrisma.quote.delete.mockResolvedValue(undefined as any);

    const req = createAuthenticatedRequest("http://localhost/api/quotes/quote-1", {
      method: "DELETE",
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(res.status).toBe(200);
  });
});

describe("POST /api/quotes/[id]/accept", () => {
  it("rejects acceptance of already-approved quote", async () => {
    mockPrisma.quote.findFirst.mockResolvedValue(
      makeQuote({ status: "APPROVED" }) as any
    );

    const req = createAuthenticatedRequest("http://localhost/api/quotes/quote-1/accept", {
      method: "POST",
    });

    const res = await ACCEPT_QUOTE(req, {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("already been accepted");
  });

  it("creates work order from accepted SENT quote", async () => {
    const quote = makeQuote({ status: "SENT", lineItems: [] });
    const wo = {
      id: "wo-new",
      workOrderNumber: "WO-20240115-001",
      customerId: "cust-1",
      siteId: "site-1",
    };

    mockPrisma.quote.findFirst.mockResolvedValue(quote as any);
    mockPrisma.workOrder.findFirst.mockResolvedValue(null); // no existing WOs
    mockPrisma.workOrder.create.mockResolvedValue(wo as any);
    mockPrisma.quote.update.mockResolvedValue({ ...quote, status: "APPROVED" } as any);
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      ...wo,
      customer: {},
      site: {},
      quote: { lineItems: [] },
    } as any);

    const req = createAuthenticatedRequest("http://localhost/api/quotes/quote-1/accept", {
      method: "POST",
    });

    const res = await ACCEPT_QUOTE(req, {
      params: Promise.resolve({ id: "quote-1" }),
    });

    const json = await res.json();
    expect(res.status).toBe(201);
    expect(mockPrisma.workOrder.create).toHaveBeenCalled();
    expect(mockPrisma.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED" }),
      })
    );
  });
});
