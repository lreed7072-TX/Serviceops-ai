import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

type AddMaterialPayload = {
  materialId?: string | null;
  name: string;
  partNumber?: string | null;
  quantity: number;
  unitCost?: number | null;
  unit?: string | null;
  notes?: string | null;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: authResult.auth.orgId },
    select: { id: true },
  });
  if (!task) return jsonError("Task not found.", 404);

  const usages = await prisma.taskMaterialUsage.findMany({
    where: { taskInstanceId: taskId, orgId: authResult.auth.orgId },
    include: { addedByUser: { select: { id: true, name: true, email: true } } },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json({ data: usages });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: authResult.auth.orgId },
    select: { id: true },
  });
  if (!task) return jsonError("Task not found.", 404);

  const body = await parseJson<AddMaterialPayload>(request);
  if (!body?.name?.trim()) return jsonError("Material name is required.", 400);
  if (!body.quantity || body.quantity <= 0) return jsonError("Quantity must be greater than 0.", 400);

  const totalCost = body.unitCost ? body.unitCost * body.quantity : null;

  const usage = await prisma.taskMaterialUsage.create({
    data: {
      orgId: authResult.auth.orgId,
      taskInstanceId: taskId,
      materialId: body.materialId ?? null,
      name: body.name.trim(),
      partNumber: body.partNumber?.trim() ?? null,
      quantity: body.quantity,
      unitCost: body.unitCost ?? null,
      unit: body.unit?.trim() ?? null,
      totalCost,
      notes: body.notes?.trim() ?? null,
      addedByUserId: authResult.auth.userId,
      addedAt: new Date(),
    },
    include: { addedByUser: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ data: usage }, { status: 201 });
}
