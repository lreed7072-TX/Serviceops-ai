import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type CheckInPayload = {
  latitude?: number;
  longitude?: number;
  notes?: string;
};

/**
 * GET /api/work-orders/:id/check-in
 * Get active check-in for current user on this WO
 */
export async function GET(request: Request, { params }: RouteParams) {
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

  return NextResponse.json({ data: checkIn });
}

/**
 * POST /api/work-orders/:id/check-in
 * Check in to a work order site
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId: auth.orgId },
    select: { id: true, status: true },
  });
  if (!workOrder) return jsonError("Work order not found.", 404);

  // Check for existing open check-in
  const existing = await prisma.siteCheckIn.findFirst({
    where: {
      workOrderId,
      orgId: auth.orgId,
      userId: auth.userId,
      checkOutAt: null,
    },
  });
  if (existing) return jsonError("Already checked in to this work order.", 400);

  const body = await parseJson<CheckInPayload>(request);

  const checkIn = await prisma.siteCheckIn.create({
    data: {
      orgId: auth.orgId,
      workOrderId,
      userId: auth.userId,
      latitude: body?.latitude ?? null,
      longitude: body?.longitude ?? null,
      notes: body?.notes?.trim() || null,
    },
  });

  // Auto-advance WO to IN_PROGRESS if still OPEN
  if (workOrder.status === "OPEN") {
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: "IN_PROGRESS" },
    });
  }

  return NextResponse.json({ data: checkIn }, { status: 201 });
}
