import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, MaterialCategory } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateMaterialPayload = {
  name?: string;
  partNumber?: string | null;
  manufacturer?: string | null;
  unitCost?: number | null;
  unit?: string | null;
  category?: MaterialCategory;
  isActive?: boolean;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const material = await prisma.material.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!material) return jsonError("Material not found.", 404);
  return NextResponse.json({ data: material });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.material.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });
  if (!existing) return jsonError("Material not found.", 404);

  const body = await parseJson<UpdateMaterialPayload>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const material = await prisma.material.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? existing.name,
      partNumber: body.partNumber !== undefined ? body.partNumber?.trim() ?? null : existing.partNumber,
      manufacturer: body.manufacturer !== undefined ? body.manufacturer?.trim() ?? null : existing.manufacturer,
      unitCost: body.unitCost !== undefined ? body.unitCost : existing.unitCost,
      unit: body.unit !== undefined ? body.unit?.trim() ?? null : existing.unit,
      category: body.category ?? existing.category,
      isActive: body.isActive ?? existing.isActive,
    },
  });

  return NextResponse.json({ data: material });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.material.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });
  if (!existing) return jsonError("Material not found.", 404);

  await prisma.material.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
