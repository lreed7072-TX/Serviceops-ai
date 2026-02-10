import { prisma } from "./prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ARCHIVE"
  | "RESTORE"
  | "STATUS_CHANGE"
  | "ASSIGN"
  | "COMPLETE"
  | "APPROVE"
  | "REJECT";

export type AuditEntityType =
  | "WORK_ORDER"
  | "QUOTE"
  | "INVOICE"
  | "CUSTOMER"
  | "SITE"
  | "ASSET"
  | "USER"
  | "PM_SCHEDULE"
  | "TASK";

interface CreateAuditLogParams {
  userId: string;
  orgId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry.
 * Failures are logged but never thrown so they don't break caller operations.
 */
export async function createAuditLog({
  userId,
  orgId,
  action,
  entityType,
  entityId,
  entityName,
  changes,
  metadata,
  ipAddress,
  userAgent,
}: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId,
        orgId,
        action,
        entityType,
        entityId,
        entityName,
        changes: changes ? JSON.stringify(changes) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Create audit log error:", error);
  }
}

export async function logWorkOrderCreated(
  userId: string,
  orgId: string,
  workOrderId: string,
  workOrderNumber: string
) {
  return createAuditLog({
    userId,
    orgId,
    action: "CREATE",
    entityType: "WORK_ORDER",
    entityId: workOrderId,
    entityName: workOrderNumber,
  });
}

export async function logWorkOrderStatusChange(
  userId: string,
  orgId: string,
  workOrderId: string,
  workOrderNumber: string,
  oldStatus: string,
  newStatus: string
) {
  return createAuditLog({
    userId,
    orgId,
    action: "STATUS_CHANGE",
    entityType: "WORK_ORDER",
    entityId: workOrderId,
    entityName: workOrderNumber,
    changes: { oldStatus, newStatus },
  });
}

export async function logEntityDeleted(
  userId: string,
  orgId: string,
  entityType: AuditEntityType,
  entityId: string,
  entityName: string
) {
  return createAuditLog({
    userId,
    orgId,
    action: "DELETE",
    entityType,
    entityId,
    entityName,
  });
}

export async function logUserRoleChange(
  adminUserId: string,
  orgId: string,
  targetUserId: string,
  userName: string,
  oldRole: string,
  newRole: string
) {
  return createAuditLog({
    userId: adminUserId,
    orgId,
    action: "UPDATE",
    entityType: "USER",
    entityId: targetUserId,
    entityName: userName,
    changes: { oldRole, newRole },
  });
}
