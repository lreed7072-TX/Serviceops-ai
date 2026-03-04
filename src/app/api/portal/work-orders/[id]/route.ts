// Portal Work Order Detail API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requirePortalAuth } from "@/lib/portal-auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/portal/work-orders/:id
 * View work order details including task completion progress
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authResult = await requirePortalAuth(request);
    if (authResult.error) return authResult.error;
    const { portal } = authResult;

    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        orgId: portal!.orgId,
        customerId: portal!.customerId,
      },
      include: {
        site: { select: { id: true, name: true, address: true, city: true, state: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            sequenceNumber: true,
          },
          orderBy: { sequenceNumber: "asc" },
        },
        visits: {
          select: {
            id: true,
            visitNumber: true,
            status: true,
            scheduledFor: true,
            startedAt: true,
            completedAt: true,
            summary: true,
          },
          orderBy: { scheduledFor: "desc" },
        },
      },
    });

    if (!workOrder) {
      return jsonError("Work order not found.", 404);
    }

    // Calculate task progress
    const totalTasks = workOrder.tasks.length;
    const completedTasks = workOrder.tasks.filter(
      (t) => t.status === "DONE"
    ).length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return NextResponse.json({
      data: {
        ...workOrder,
        progress: {
          total: totalTasks,
          completed: completedTasks,
          percent: progressPercent,
        },
      },
    });
  } catch (error) {
    console.error("Portal work order detail error:", error);
    return jsonError("Failed to fetch work order", 500);
  }
}
