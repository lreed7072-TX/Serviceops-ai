import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, StandardsPackStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

type UpdatePackPayload = {
  name?: string;
  description?: string | null;
  equipmentType?: string | null;
  status?: StandardsPackStatus;
  estimatedHours?: number | null;
};

/**
 * GET /api/standards-packs/:id
 * Get a single pack with all its tasks
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const pack = await prisma.standardsPack.findFirst({
    where: { id, orgId: authResult.auth.orgId },
    include: {
      tasks: {
        orderBy: [{ packageType: "asc" }, { sequenceNumber: "asc" }],
      },
    },
  });

  if (!pack) {
    return jsonError("Standards pack not found.", 404);
  }

  return NextResponse.json({ data: pack });
}

/**
 * PUT /api/standards-packs/:id
 * Update a standards pack
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.standardsPack.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Standards pack not found.", 404);
  }

  const body = await parseJson<UpdatePackPayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.", 400);
  }

  const pack = await prisma.standardsPack.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? existing.name,
      description: body.description !== undefined ? body.description?.trim() ?? null : existing.description,
      equipmentType: body.equipmentType !== undefined ? body.equipmentType?.trim() ?? null : existing.equipmentType,
      status: body.status ?? existing.status,
      estimatedHours: body.estimatedHours !== undefined ? body.estimatedHours : existing.estimatedHours,
    },
    include: {
      tasks: {
        orderBy: [{ packageType: "asc" }, { sequenceNumber: "asc" }],
      },
    },
  });

  return NextResponse.json({ data: pack });
}

/**
 * DELETE /api/standards-packs/:id
 * Delete a standards pack (cascades to tasks)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.standardsPack.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Standards pack not found.", 404);
  }

  await prisma.standardsPack.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
