import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { Role, WorkOrderStatus } from "@prisma/client";

type WorkOrderUpdatePayload = {
  title?: string;
  description?: string | null;
  status?: WorkOrderStatus;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  return NextResponse.json({ data: workOrder });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<WorkOrderUpdatePayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  const existing = await prisma.workOrder.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Work order not found.", 404);
  }

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      status: body.status ?? existing.status,
    },
  });

  return NextResponse.json({ data: workOrder });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.workOrder.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Work order not found.", 404);
  }

  await prisma.workOrder.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
