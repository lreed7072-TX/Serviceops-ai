import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/work-orders/:id/check-out
 * Check out from a work order site
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const checkIn = await prisma.siteCheckIn.findFirst({
    where: {
      workOrderId,
      orgId: auth.orgId,
      userId: auth.userId,
      checkOutAt: null,
    },
    orderBy: { checkInAt: "desc" },
  });

  if (!checkIn) return jsonError("No active check-in found.", 404);

  const updated = await prisma.siteCheckIn.update({
    where: { id: checkIn.id },
    data: { checkOutAt: new Date() },
  });

  return NextResponse.json({ data: updated });
}
