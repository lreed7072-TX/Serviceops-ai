import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, StandardsPackStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePackPayload = {
  name: string;
  description?: string | null;
  equipmentType?: string | null;
  status?: StandardsPackStatus;
  estimatedHours?: number | null;
};

/**
 * GET /api/standards-packs
 * List all standards packs for the org
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as StandardsPackStatus | null;
  const equipmentType = searchParams.get("equipmentType");

  const where: any = { orgId: authResult.auth.orgId };
  if (status) where.status = status;
  if (equipmentType) where.equipmentType = equipmentType;

  const packs = await prisma.standardsPack.findMany({
    where,
    include: {
      _count: { select: { tasks: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: packs });
}

/**
 * POST /api/standards-packs
 * Create a new standards pack
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Only ADMIN and DISPATCHER can create packs
  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<CreatePackPayload>(request);
  if (!body?.name?.trim()) {
    return jsonError("Pack name is required.", 400);
  }

  const pack = await prisma.standardsPack.create({
    data: {
      orgId: authResult.auth.orgId,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      equipmentType: body.equipmentType?.trim() ?? null,
      status: body.status ?? "DRAFT",
      estimatedHours: body.estimatedHours ?? null,
    },
    include: {
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json({ data: pack }, { status: 201 });
}
