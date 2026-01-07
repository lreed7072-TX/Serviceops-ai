import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, MaterialCategory } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateMaterialPayload = {
  name: string;
  partNumber?: string | null;
  manufacturer?: string | null;
  unitCost?: number | null;
  unit?: string | null;
  category?: MaterialCategory;
  isActive?: boolean;
};

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";
  const category = searchParams.get("category") as MaterialCategory | null;

  const where: any = { orgId: authResult.auth.orgId };
  if (activeOnly) where.isActive = true;
  if (category) where.category = category;

  const materials = await prisma.material.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: materials });
}

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<CreateMaterialPayload>(request);
  if (!body?.name?.trim()) {
    return jsonError("Material name is required.", 400);
  }

  const material = await prisma.material.create({
    data: {
      orgId: authResult.auth.orgId,
      name: body.name.trim(),
      partNumber: body.partNumber?.trim() ?? null,
      manufacturer: body.manufacturer?.trim() ?? null,
      unitCost: body.unitCost ?? null,
      unit: body.unit?.trim() ?? null,
      category: body.category ?? "PART",
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json({ data: material }, { status: 201 });
}
