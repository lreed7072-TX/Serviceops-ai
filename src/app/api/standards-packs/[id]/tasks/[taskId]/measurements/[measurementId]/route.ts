import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, MeasurementType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; taskId: string; measurementId: string }> };

type UpdateMeasurementDefPayload = {
  name?: string;
  unit?: string | null;
  measurementType?: MeasurementType;
  minValue?: number | null;
  maxValue?: number | null;
  isRequired?: boolean;
  sortOrder?: number;
};

/**
 * PUT /api/standards-packs/:id/tasks/:taskId/measurements/:measurementId
 * Update a measurement definition
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id: packId, taskId, measurementId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.measurementDefinition.findFirst({
    where: {
      id: measurementId,
      standardsPackTaskId: taskId,
      orgId: authResult.auth.orgId,
    },
    include: {
      standardsPackTask: { select: { standardsPackId: true } },
    },
  });

  if (!existing || !existing.standardsPackTask || existing.standardsPackTask.standardsPackId !== packId) {
    return jsonError("Measurement definition not found.", 404);
  }

  const body = await parseJson<UpdateMeasurementDefPayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.", 400);
  }

  const definition = await prisma.measurementDefinition.update({
    where: { id: measurementId },
    data: {
      name: body.name?.trim() ?? existing.name,
      unit: body.unit !== undefined ? body.unit?.trim() ?? null : existing.unit,
      measurementType: body.measurementType ?? existing.measurementType,
      minValue: body.minValue !== undefined ? body.minValue : existing.minValue,
      maxValue: body.maxValue !== undefined ? body.maxValue : existing.maxValue,
      isRequired: body.isRequired ?? existing.isRequired,
      sortOrder: body.sortOrder ?? existing.sortOrder,
    },
  });

  return NextResponse.json({ data: definition });
}

/**
 * DELETE /api/standards-packs/:id/tasks/:taskId/measurements/:measurementId
 * Delete a measurement definition
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: packId, taskId, measurementId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.measurementDefinition.findFirst({
    where: {
      id: measurementId,
      standardsPackTaskId: taskId,
      orgId: authResult.auth.orgId,
    },
    include: {
      standardsPackTask: { select: { standardsPackId: true } },
    },
  });

  if (!existing || !existing.standardsPackTask || existing.standardsPackTask.standardsPackId !== packId) {
    return jsonError("Measurement definition not found.", 404);
  }

  await prisma.measurementDefinition.delete({ where: { id: measurementId } });

  return NextResponse.json({ data: { id: measurementId } });
}
