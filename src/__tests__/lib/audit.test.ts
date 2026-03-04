import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMockPrisma } from "../helpers/mock-prisma";
import { makeAuditLog } from "../helpers/test-data";
import {
  createAuditLog,
  logWorkOrderCreated,
  logWorkOrderStatusChange,
  logEntityDeleted,
  logUserRoleChange,
} from "@/lib/audit";

const mockPrisma = getMockPrisma();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAuditLog", () => {
  it("creates an audit log entry", async () => {
    const auditLog = makeAuditLog();
    mockPrisma.auditLog.create.mockResolvedValue(auditLog as any);

    const result = await createAuditLog({
      userId: "user-1",
      orgId: "org-1",
      action: "CREATE",
      entityType: "WORK_ORDER",
      entityId: "wo-1",
      entityName: "WO00001",
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        orgId: "org-1",
        action: "CREATE",
        entityType: "WORK_ORDER",
        entityId: "wo-1",
        entityName: "WO00001",
      }),
    });
    expect(result).toEqual(auditLog);
  });

  it("stringifies changes and metadata as JSON", async () => {
    mockPrisma.auditLog.create.mockResolvedValue(makeAuditLog() as any);

    await createAuditLog({
      userId: "user-1",
      orgId: "org-1",
      action: "UPDATE",
      entityType: "WORK_ORDER",
      entityId: "wo-1",
      changes: { oldStatus: "OPEN", newStatus: "IN_PROGRESS" },
      metadata: { source: "api" },
    });

    const callData = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(callData.changes).toBe(
      JSON.stringify({ oldStatus: "OPEN", newStatus: "IN_PROGRESS" })
    );
    expect(callData.metadata).toBe(JSON.stringify({ source: "api" }));
  });

  it("does not throw on error - logs and swallows", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.auditLog.create.mockRejectedValue(new Error("DB down"));

    const result = await createAuditLog({
      userId: "user-1",
      orgId: "org-1",
      action: "CREATE",
      entityType: "WORK_ORDER",
      entityId: "wo-1",
    });

    expect(result).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Create audit log error:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});

describe("logWorkOrderCreated", () => {
  it("calls createAuditLog with correct params", async () => {
    mockPrisma.auditLog.create.mockResolvedValue(makeAuditLog() as any);

    await logWorkOrderCreated("user-1", "org-1", "wo-1", "WO00001");

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CREATE",
        entityType: "WORK_ORDER",
        entityId: "wo-1",
        entityName: "WO00001",
      }),
    });
  });
});

describe("logWorkOrderStatusChange", () => {
  it("records old and new status as changes", async () => {
    mockPrisma.auditLog.create.mockResolvedValue(makeAuditLog() as any);

    await logWorkOrderStatusChange(
      "user-1",
      "org-1",
      "wo-1",
      "WO00001",
      "OPEN",
      "IN_PROGRESS"
    );

    const callData = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(callData.action).toBe("STATUS_CHANGE");
    expect(JSON.parse(callData.changes)).toEqual({
      oldStatus: "OPEN",
      newStatus: "IN_PROGRESS",
    });
  });
});

describe("logEntityDeleted", () => {
  it("records deletion with entity details", async () => {
    mockPrisma.auditLog.create.mockResolvedValue(makeAuditLog() as any);

    await logEntityDeleted("user-1", "org-1", "CUSTOMER", "cust-1", "Acme");

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DELETE",
        entityType: "CUSTOMER",
        entityId: "cust-1",
        entityName: "Acme",
      }),
    });
  });
});

describe("logUserRoleChange", () => {
  it("records old and new role", async () => {
    mockPrisma.auditLog.create.mockResolvedValue(makeAuditLog() as any);

    await logUserRoleChange("admin-1", "org-1", "user-2", "Jane", "TECH", "DISPATCHER");

    const callData = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(callData.action).toBe("UPDATE");
    expect(callData.entityType).toBe("USER");
    expect(JSON.parse(callData.changes)).toEqual({
      oldRole: "TECH",
      newRole: "DISPATCHER",
    });
  });
});
