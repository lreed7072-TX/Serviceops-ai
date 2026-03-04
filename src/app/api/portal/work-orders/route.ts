// Portal Work Orders List API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requirePortalAuth } from "@/lib/portal-auth";

export const runtime = "nodejs";

/**
 * GET /api/portal/work-orders
 * List work orders for portal customer (read-only)
 */
export async function GET(request: Request) {
  try {
    const authResult = await requirePortalAuth(request);
    if (authResult.error) return authResult.error;
    const { portal } = authResult;

    const workOrders = await prisma.workOrder.findMany({
      where: {
        orgId: portal!.orgId,
        customerId: portal!.customerId,
      },
      include: {
        site: { select: { id: true, name: true } },
        _count: {
          select: {
            tasks: true,
            visits: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: workOrders });
  } catch (error) {
    console.error("Portal work orders list error:", error);
    return jsonError("Failed to fetch work orders", 500);
  }
}
