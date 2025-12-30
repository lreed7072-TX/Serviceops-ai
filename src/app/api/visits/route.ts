import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, VisitStatus } from "@prisma/client";
export const runtime = "nodejs";

type VisitPayload = {
  workOrderId?: string;
  assignedTechId?: string | null;
  scheduledFor?: string | null;
  status?: VisitStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  summary?: string | null;
  outcome?: string | null;
};

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const visits = await prisma.visit.findMany({
    where: { orgId: authResult.auth.orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: visits });
}

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<VisitPayload>(request);
  if (!body?.workOrderId) {
    return jsonError("Work order ID is required.");
  }

  const [workOrder, assignedTech] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id: body.workOrderId, orgId: authResult.auth.orgId },
    }),
    body.assignedTechId
      ? prisma.user.findFirst({
          where: { id: body.assignedTechId, orgId: authResult.auth.orgId },
        })
      : Promise.resolve(null),
  ]);

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  if (body.assignedTechId && !assignedTech) {
    return jsonError("Assigned tech not found.", 404);
  }

  const visit = await prisma.visit.create({
    data: {
      orgId: authResult.auth.orgId,
      workOrderId: workOrder.id,
      assignedTechId: assignedTech?.id ?? null,
      status: body.status ?? VisitStatus.PLANNED,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      startedAt: body.startedAt ? new Date(body.startedAt) : null,
      completedAt: body.completedAt ? new Date(body.completedAt) : null,
      summary: body.summary ?? null,
      outcome: body.outcome ?? null,
    },
  });

  return NextResponse.json({ data: visit }, { status: 201 });
}
