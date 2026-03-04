import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMockPrisma } from "../helpers/mock-prisma";
import {
  createAuthenticatedRequest,
  createUnauthenticatedRequest,
  mockForbiddenRole,
} from "../helpers/mock-auth";
import { makeWorkOrder, makeCustomer, makeSite } from "../helpers/test-data";

// Import route handlers
import { GET, POST } from "@/app/api/work-orders/route";
import {
  GET as GET_BY_ID,
  PATCH,
  DELETE,
} from "@/app/api/work-orders/[id]/route";

const mockPrisma = getMockPrisma();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/work-orders", () => {
  it("returns 401 when unauthenticated", async () => {
    const req = createUnauthenticatedRequest("http://localhost/api/work-orders");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns work orders scoped to org", async () => {
    const workOrders = [makeWorkOrder(), makeWorkOrder({ id: "wo-2", workOrderNumber: "WO00002" })];
    mockPrisma.workOrder.findMany.mockResolvedValue(workOrders as any);

    const req = createAuthenticatedRequest("http://localhost/api/work-orders");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    // Verify orgId filter was used in the query
    expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-1" }),
      })
    );
  });
});

describe("POST /api/work-orders", () => {
  it("returns 401 when unauthenticated", async () => {
    const req = createUnauthenticatedRequest("http://localhost/api/work-orders", {
      method: "POST",
      body: { customerId: "c1", siteId: "s1", title: "Test" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when TECH role tries to create", async () => {
    mockForbiddenRole("TECH");
    const req = createAuthenticatedRequest("http://localhost/api/work-orders", {
      method: "POST",
      body: { customerId: "c1", siteId: "s1", title: "Test" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = createAuthenticatedRequest("http://localhost/api/work-orders", {
      method: "POST",
      body: { customerId: "c1" }, // missing siteId and title
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it("creates work order successfully with valid data", async () => {
    const customer = makeCustomer();
    const site = makeSite();
    const wo = makeWorkOrder();

    mockPrisma.customer.findFirst.mockResolvedValue(customer as any);
    mockPrisma.site.findFirst.mockResolvedValue(site as any);
    mockPrisma.workOrder.findFirst.mockResolvedValue(null); // no existing WOs
    mockPrisma.workOrder.create.mockResolvedValue(wo as any);
    mockPrisma.workPackage.createMany.mockResolvedValue({ count: 1 });

    const req = createAuthenticatedRequest("http://localhost/api/work-orders", {
      method: "POST",
      body: {
        customerId: "cust-1",
        siteId: "site-1",
        title: "Fix pump bearing",
      },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.id).toBe("wo-1");
    expect(mockPrisma.workOrder.create).toHaveBeenCalled();
  });

  it("returns 404 when customer not found", async () => {
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.site.findFirst.mockResolvedValue(makeSite() as any);

    const req = createAuthenticatedRequest("http://localhost/api/work-orders", {
      method: "POST",
      body: {
        customerId: "nonexistent",
        siteId: "site-1",
        title: "Test",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/work-orders/[id]", () => {
  it("returns 404 when work order not found", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue(null);

    const req = createAuthenticatedRequest("http://localhost/api/work-orders/nonexistent");
    const res = await GET_BY_ID(req as any, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns work order with summary metrics", async () => {
    const wo = {
      ...makeWorkOrder(),
      customer: { id: "cust-1", name: "Acme", primaryPhone: null, primaryEmail: null },
      site: { id: "site-1", name: "Main", address: "123 St" },
      packages: [
        {
          tasks: [
            {
              status: "DONE",
              materialUsages: [{ totalCost: 100 }],
              assignedTo: null,
              timeEntries: [],
              measurements: [],
            },
            {
              status: "TODO",
              materialUsages: [],
              assignedTo: null,
              timeEntries: [],
              measurements: [],
            },
          ],
        },
      ],
      visits: [],
      timeEntries: [{ id: "te-1", accumulatedSeconds: 3600, status: "STOPPED" }],
    };

    mockPrisma.workOrder.findUnique.mockResolvedValue(wo as any);

    const req = createAuthenticatedRequest("http://localhost/api/work-orders/wo-1");
    const res = await GET_BY_ID(req as any, {
      params: Promise.resolve({ id: "wo-1" }),
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.summary.totalTasks).toBe(2);
    expect(json.data.summary.completedTasks).toBe(1);
    expect(json.data.summary.completionRate).toBe(50);
    expect(json.data.summary.totalLaborHours).toBe(1);
    expect(json.data.summary.totalMaterialCost).toBe(100);
  });
});

describe("PATCH /api/work-orders/[id]", () => {
  it("rejects editing a COMPLETED work order", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue(
      makeWorkOrder({ status: "COMPLETED" }) as any
    );

    const req = createAuthenticatedRequest("http://localhost/api/work-orders/wo-1", {
      method: "PATCH",
      body: { title: "New title" },
    });

    const res = await PATCH(req as any, {
      params: Promise.resolve({ id: "wo-1" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("completed");
  });

  it("updates work order successfully", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue(makeWorkOrder() as any);
    mockPrisma.workOrder.update.mockResolvedValue(
      makeWorkOrder({ title: "Updated title" }) as any
    );

    const req = createAuthenticatedRequest("http://localhost/api/work-orders/wo-1", {
      method: "PATCH",
      body: { title: "Updated title" },
    });

    const res = await PATCH(req as any, {
      params: Promise.resolve({ id: "wo-1" }),
    });

    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/work-orders/[id]", () => {
  it("returns 403 when non-ADMIN tries to delete", async () => {
    mockForbiddenRole("TECH");
    const req = createAuthenticatedRequest("http://localhost/api/work-orders/wo-1", {
      method: "DELETE",
    });

    const res = await DELETE(req as any, {
      params: Promise.resolve({ id: "wo-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("only allows deleting OPEN or CANCELED work orders", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue(
      makeWorkOrder({ status: "IN_PROGRESS" }) as any
    );

    const req = createAuthenticatedRequest("http://localhost/api/work-orders/wo-1", {
      method: "DELETE",
      role: "ADMIN",
    });

    const res = await DELETE(req as any, {
      params: Promise.resolve({ id: "wo-1" }),
    });

    expect(res.status).toBe(400);
  });

  it("deletes OPEN work order successfully", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue(
      makeWorkOrder({ status: "OPEN", workOrderNumber: "WO00001" }) as any
    );
    mockPrisma.workOrder.delete.mockResolvedValue(undefined as any);

    const req = createAuthenticatedRequest("http://localhost/api/work-orders/wo-1", {
      method: "DELETE",
      role: "ADMIN",
    });

    const res = await DELETE(req as any, {
      params: Promise.resolve({ id: "wo-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.workOrder.delete).toHaveBeenCalledWith({
      where: { id: "wo-1" },
    });
  });
});
