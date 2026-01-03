import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, VisitStatus } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

type VisitUpdatePayload = {
  assignedTechId?: string | null;
  status?: VisitStatus;
  scheduledFor?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  summary?: string | null;
  outcome?: string | null;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const whereVisit: any = { id, orgId: authResult.auth.orgId };

  // TECH can only view visits assigned to them
  if (authResult.auth.role === Role.TECH) {
    whereVisit.assignedTechId = authResult.auth.userId;
  }

  const visit = await prisma.visit.findFirst({ where: whereVisit });

  if (!visit) return jsonError("Visit not found.", 404);
  return NextResponse.json({ data: visit });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Only ADMIN/DISPATCHER can edit visit fields (TECH is view-only for now)
  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<VisitUpdatePayload>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const existing = await prisma.visit.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });
  if (!existing) return jsonError("Visit not found.", 404);

  let assignedTechId = existing.assignedTechId;
  if (body.assignedTechId !== undefined) {
    if (body.assignedTechId) {
      const assignedTech = await prisma.user.findFirst({
        where: { id: body.assignedTechId, orgId: authResult.auth.orgId },
      });
      if (!assignedTech) return jsonError("Assigned tech not found.", 404);
      assignedTechId = assignedTech.id;
    } else {
      assignedTechId = null;
    }
  }

  const visit = await prisma.visit.update({
    where: { id: existing.id },
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

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.visit.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });
  if (!existing) return jsonError("Visit not found.", 404);

  await prisma.visit.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
