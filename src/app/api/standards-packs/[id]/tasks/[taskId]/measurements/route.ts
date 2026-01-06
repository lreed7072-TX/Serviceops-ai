import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, MeasurementType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; taskId: string }> };

type CreateMeasurementDefPayload = {
  name: string;
  unit?: string | null;
  measurementType?: MeasurementType;
  minValue?: number | null;
  maxValue?: number | null;
  isRequired?: boolean;
  sortOrder?: number;
};

/**
 * GET /api/standards-packs/:id/tasks/:taskId/measurements
 * List all measurement definitions for a task template
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: packId, taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Verify task exists in pack and org
  const task = await prisma.standardsPackTask.findFirst({
    where: { id: taskId, standardsPackId: packId, orgId: authResult.auth.orgId },
    select: { id: true },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  const definitions = await prisma.measurementDefinition.findMany({
    where: { standardsPackTaskId: taskId, orgId: authResult.auth.orgId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ data: definitions });
}

/**
 * POST /api/standards-packs/:id/tasks/:taskId/measurements
 * Add a measurement definition to a task template
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: packId, taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  // Verify task exists
  const task = await prisma.standardsPackTask.findFirst({
    where: { id: taskId, standardsPackId: packId, orgId: authResult.auth.orgId },
    select: { id: true },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  const body = await parseJson<CreateMeasurementDefPayload>(request);
  if (!body?.name?.trim()) {
    return jsonError("Measurement name is required.", 400);
  }

  // Get max sort order
  const maxSort = await prisma.measurementDefinition.aggregate({
    where: { standardsPackTaskId: taskId },
    _max: { sortOrder: true },
  });

  const definition = await prisma.measurementDefinition.create({
    data: {
      orgId: authResult.auth.orgId,
      standardsPackTaskId: taskId,
      name: body.name.trim(),
      unit: body.unit?.trim() ?? null,
      measurementType: body.measurementType ?? "NUMERIC",
      minValue: body.minValue ?? null,
      maxValue: body.maxValue ?? null,
      isRequired: body.isRequired ?? false,
      sortOrder: body.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ data: definition }, { status: 201 });
}
