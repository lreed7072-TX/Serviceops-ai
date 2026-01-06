import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, WorkPackageType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; taskId: string }> };

type UpdateTaskPayload = {
  title?: string;
  description?: string | null;
  packageType?: WorkPackageType;
  sequenceNumber?: number;
  isCritical?: boolean;
  requiresEvidence?: boolean;
  estimatedMinutes?: number | null;
};

/**
 * GET /api/standards-packs/:id/tasks/:taskId
 * Get a single task
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: packId, taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const task = await prisma.standardsPackTask.findFirst({
    where: {
      id: taskId,
      standardsPackId: packId,
      orgId: authResult.auth.orgId,
    },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  return NextResponse.json({ data: task });
}

/**
 * PUT /api/standards-packs/:id/tasks/:taskId
 * Update a task
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id: packId, taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.standardsPackTask.findFirst({
    where: {
      id: taskId,
      standardsPackId: packId,
      orgId: authResult.auth.orgId,
    },
  });

  if (!existing) {
    return jsonError("Task not found.", 404);
  }

  const body = await parseJson<UpdateTaskPayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.", 400);
  }

  const task = await prisma.standardsPackTask.update({
    where: { id: taskId },
    data: {
      title: body.title?.trim() ?? existing.title,
      description: body.description !== undefined ? body.description?.trim() ?? null : existing.description,
      packageType: body.packageType ?? existing.packageType,
      sequenceNumber: body.sequenceNumber ?? existing.sequenceNumber,
      isCritical: body.isCritical ?? existing.isCritical,
      requiresEvidence: body.requiresEvidence ?? existing.requiresEvidence,
      estimatedMinutes: body.estimatedMinutes !== undefined ? body.estimatedMinutes : existing.estimatedMinutes,
    },
  });

  return NextResponse.json({ data: task });
}

/**
 * DELETE /api/standards-packs/:id/tasks/:taskId
 * Delete a task
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: packId, taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.standardsPackTask.findFirst({
    where: {
      id: taskId,
      standardsPackId: packId,
      orgId: authResult.auth.orgId,
    },
  });

  if (!existing) {
    return jsonError("Task not found.", 404);
  }

  await prisma.standardsPackTask.delete({ where: { id: taskId } });

  return NextResponse.json({ data: { id: taskId } });
}
