import { prisma } from "./prisma";

export type NotificationType =
  | "WORK_ORDER_ASSIGNED"
  | "WORK_ORDER_STATUS_CHANGED"
  | "TASK_COMPLETED"
  | "COMMENT_ADDED"
  | "PM_SCHEDULE_DUE"
  | "QUOTE_APPROVED"
  | "QUOTE_REJECTED"
  | "INVOICE_PAID";

interface CreateNotificationParams {
  userId: string;
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for a user.
 * Failures are logged but never thrown so they don't break caller operations.
 */
export async function createNotification({
  userId,
  orgId,
  type,
  title,
  message,
  actionUrl,
  metadata,
}: CreateNotificationParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        orgId,
        type,
        title,
        message,
        actionUrl,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (error) {
    console.error("Create notification error:", error);
  }
}

export async function notifyWorkOrderAssigned(
  workOrderId: string,
  assignedToUserId: string,
  orgId: string,
  workOrderNumber: string,
  title: string
) {
  return createNotification({
    userId: assignedToUserId,
    orgId,
    type: "WORK_ORDER_ASSIGNED",
    title: "New Work Order Assigned",
    message: `You have been assigned to ${workOrderNumber}: ${title}`,
    actionUrl: `/work-orders/${workOrderId}`,
    metadata: { workOrderId, workOrderNumber },
  });
}

export async function notifyWorkOrderStatusChanged(
  workOrderId: string,
  userId: string,
  orgId: string,
  workOrderNumber: string,
  oldStatus: string,
  newStatus: string
) {
  return createNotification({
    userId,
    orgId,
    type: "WORK_ORDER_STATUS_CHANGED",
    title: "Work Order Status Updated",
    message: `${workOrderNumber} changed from ${oldStatus} to ${newStatus}`,
    actionUrl: `/work-orders/${workOrderId}`,
    metadata: { workOrderId, workOrderNumber, oldStatus, newStatus },
  });
}

export async function notifyPMScheduleDue(
  scheduleId: string,
  userId: string,
  orgId: string,
  scheduleName: string,
  dueDate: Date
) {
  return createNotification({
    userId,
    orgId,
    type: "PM_SCHEDULE_DUE",
    title: "PM Schedule Due",
    message: `${scheduleName} is due on ${dueDate.toLocaleDateString()}`,
    actionUrl: `/pm-schedules/${scheduleId}`,
    metadata: { scheduleId, scheduleName, dueDate: dueDate.toISOString() },
  });
}

export async function notifyMultipleUsers(
  userIds: string[],
  orgId: string,
  type: NotificationType,
  title: string,
  message: string,
  actionUrl?: string,
  metadata?: Record<string, unknown>
) {
  return Promise.all(
    userIds.map((userId) =>
      createNotification({ userId, orgId, type, title, message, actionUrl, metadata })
    )
  );
}
