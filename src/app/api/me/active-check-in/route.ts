import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/me/active-check-in
 * Returns the current user's active (un-checked-out) site check-in, if any.
 * Includes work order + site info for the banner display.
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const activeCheckIn = await prisma.siteCheckIn.findFirst({
    where: {
      orgId: auth.orgId,
      userId: auth.userId,
      checkOutAt: null,
    },
    orderBy: { checkInAt: "desc" },
    include: {
      workOrder: {
        select: {
          id: true,
          title: true,
          workOrderNumber: true,
          status: true,
          site: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
            },
          },
        },
      },
    },
  });

  if (!activeCheckIn) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      id: activeCheckIn.id,
      workOrderId: activeCheckIn.workOrderId,
      checkInAt: activeCheckIn.checkInAt.toISOString(),
      latitude: activeCheckIn.latitude,
      longitude: activeCheckIn.longitude,
      workOrder: {
        id: activeCheckIn.workOrder.id,
        title: activeCheckIn.workOrder.title,
        workOrderNumber: activeCheckIn.workOrder.workOrderNumber,
        status: activeCheckIn.workOrder.status,
      },
      site: activeCheckIn.workOrder.site
        ? {
            name: activeCheckIn.workOrder.site.name,
            address: [
              activeCheckIn.workOrder.site.address,
              activeCheckIn.workOrder.site.city,
              activeCheckIn.workOrder.site.state,
            ]
              .filter(Boolean)
              .join(", "),
          }
        : null,
    },
  });
}
