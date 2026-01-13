import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type AddMaterialPayload = {
  name: string;
  partNumber?: string;
  quantity: number;
  unit?: string;
  unitCost?: number;
};

/**
 * POST /api/tasks/:id/materials
 * Add material usage to a task
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER, Role.TECH]);
  if (roleError) return roleError;

  const body = await parseJson<AddMaterialPayload>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  if (!body.name?.trim()) return jsonError("Material name is required.", 400);
  if (!body.quantity || body.quantity <= 0) return jsonError("Valid quantity is required.", 400);

  // Verify task exists and belongs to org
  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: authResult.auth.orgId },
  });

  if (!task) return jsonError("Task not found.", 404);

  const totalCost = body.unitCost && body.quantity 
    ? Number(body.unitCost) * Number(body.quantity) 
    : null;

  const material = await prisma.taskMaterialUsage.create({
    data: {
      orgId: authResult.auth.orgId,
      taskInstanceId: taskId,
      name: body.name.trim(),
      partNumber: body.partNumber?.trim() || null,
      quantity: body.quantity,
      unit: body.unit?.trim() || null,
      unitCost: body.unitCost || null,
      totalCost,
    },
  });

  return NextResponse.json({ data: material });
}
