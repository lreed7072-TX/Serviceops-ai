import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { MeasurementType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

type CaptureMeasurementPayload = {
  measurementId?: string; // Existing measurement to update
  name?: string; // For ad-hoc measurements
  unit?: string | null;
  measurementType?: MeasurementType;
  minValue?: number | null;
  maxValue?: number | null;
  numericValue?: number | null;
  textValue?: string | null;
  passFail?: boolean | null;
};

function calculateWithinSpec(
  type: MeasurementType,
  numericValue: number | null,
  minValue: number | null,
  maxValue: number | null
): boolean | null {
  if (type !== "NUMERIC" || numericValue === null) return null;
  if (minValue === null && maxValue === null) return null;
  
  let withinSpec = true;
  if (minValue !== null && numericValue < minValue) withinSpec = false;
  if (maxValue !== null && numericValue > maxValue) withinSpec = false;
  return withinSpec;
}

/**
 * GET /api/tasks/:id/measurements
 * List all measurements for a task instance
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Verify task exists in org
  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: authResult.auth.orgId },
    select: { id: true },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  const measurements = await prisma.taskMeasurement.findMany({
    where: { taskInstanceId: taskId, orgId: authResult.auth.orgId },
    include: {
      capturedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: measurements });
}

/**
 * POST /api/tasks/:id/measurements
 * Capture or update a measurement value
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Verify task exists
  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: authResult.auth.orgId },
    select: { id: true },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  const body = await parseJson<CaptureMeasurementPayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.", 400);
  }

  // If measurementId provided, update existing
  if (body.measurementId) {
    const existing = await prisma.taskMeasurement.findFirst({
      where: { id: body.measurementId, taskInstanceId: taskId, orgId: authResult.auth.orgId },
    });

    if (!existing) {
      return jsonError("Measurement not found.", 404);
    }

    const isWithinSpec = calculateWithinSpec(
      existing.measurementType,
      body.numericValue ?? existing.numericValue,
      existing.minValue,
      existing.maxValue
    );

    const updated = await prisma.taskMeasurement.update({
      where: { id: body.measurementId },
      data: {
        numericValue: body.numericValue !== undefined ? body.numericValue : existing.numericValue,
        textValue: body.textValue !== undefined ? body.textValue : existing.textValue,
        passFail: body.passFail !== undefined ? body.passFail : existing.passFail,
        isWithinSpec,
        capturedAt: new Date(),
        capturedByUserId: authResult.auth.userId,
      },
      include: {
        capturedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: updated });
  }

  // Create new ad-hoc measurement
  if (!body.name?.trim()) {
    return jsonError("Measurement name is required for new measurements.", 400);
  }

  const measurementType = body.measurementType ?? "NUMERIC";
  const isWithinSpec = calculateWithinSpec(
    measurementType,
    body.numericValue ?? null,
    body.minValue ?? null,
    body.maxValue ?? null
  );

  const measurement = await prisma.taskMeasurement.create({
    data: {
      orgId: authResult.auth.orgId,
      taskInstanceId: taskId,
      name: body.name.trim(),
      unit: body.unit?.trim() ?? null,
      measurementType,
      minValue: body.minValue ?? null,
      maxValue: body.maxValue ?? null,
      numericValue: body.numericValue ?? null,
      textValue: body.textValue ?? null,
      passFail: body.passFail ?? null,
      isWithinSpec,
      capturedAt: new Date(),
      capturedByUserId: authResult.auth.userId,
    },
    include: {
      capturedByUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ data: measurement }, { status: 201 });
}
