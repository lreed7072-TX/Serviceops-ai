import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type AddMaterialPayload = {
  materialId?: string;
  name: string;
  partNumber?: string;
  quantity: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
};

/**
 * POST /api/tasks/:id/materials
 * Add material usage to a task
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<AddMaterialPayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.", 400);
  }

  if (!body.name?.trim()) {
    return jsonError("Material name is required.", 400);
  }

  if (!body.quantity || body.quantity <= 0) {
    return jsonError("Quantity must be greater than 0.", 400);
  }

  // Verify task exists and belongs to org
  const task = await prisma.taskInstance.findFirst({
    where: {
      id: taskId,
      orgId: authResult.auth.orgId,
    },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  const materialUsage = await prisma.taskMaterialUsage.create({
    data: {
      orgId: authResult.auth.orgId,
      taskInstanceId: taskId,
      workOrderId: task.workOrderId,
      materialId: body.materialId || null,
      name: body.name.trim(),
      partNumber: body.partNumber?.trim() || null,
      quantity: body.quantity,
      unit: body.unit?.trim() || "ea",
      unitCost: body.unitCost || null,
      totalCost: body.totalCost || (body.unitCost ? body.unitCost * body.quantity : null),
    },
  });

  return NextResponse.json({ data: materialUsage });
}

/**
 * GET /api/tasks/:id/materials
 * Get all materials for a task
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const materials = await prisma.taskMaterialUsage.findMany({
    where: {
      taskInstanceId: taskId,
      orgId: authResult.auth.orgId,
    },
    include: {
      material: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: materials });
}
