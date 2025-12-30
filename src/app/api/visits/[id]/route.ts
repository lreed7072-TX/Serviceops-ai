import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { VisitStatus } from "@prisma/client";
export const runtime = "nodejs";

type VisitUpdatePayload = {
  assignedTechId?: string | null;
  status?: VisitStatus;
  scheduledFor?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  summary?: string | null;
  outcome?: string | null;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const visit = await prisma.visit.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!visit) {
    return jsonError("Visit not found.", 404);
  }

  return NextResponse.json({ data: visit });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<VisitUpdatePayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  const existing = await prisma.visit.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Visit not found.", 404);
  }

  let assignedTechId = existing.assignedTechId;
  if (body.assignedTechId !== undefined) {
    if (body.assignedTechId) {
      const assignedTech = await prisma.user.findFirst({
        where: { id: body.assignedTechId, orgId: authResult.auth.orgId },
      });
      if (!assignedTech) {
        return jsonError("Assigned tech not found.", 404);
      }
      assignedTechId = assignedTech.id;
    } else {
      assignedTechId = null;
    }
  }

  const visit = await prisma.visit.update({
    where: { id },
    data: {
      assignedTechId,
      status: body.status ?? existing.status,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : existing.scheduledFor,
      startedAt: body.startedAt ? new Date(body.startedAt) : existing.startedAt,
      completedAt: body.completedAt ? new Date(body.completedAt) : existing.completedAt,
      summary: body.summary ?? existing.summary,
      outcome: body.outcome ?? existing.outcome,
    },
  });

  return NextResponse.json({ data: visit });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const existing = await prisma.visit.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Visit not found.", 404);
  }

  await prisma.visit.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
