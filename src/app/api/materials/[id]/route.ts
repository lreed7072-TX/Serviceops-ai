// Individual Material Management API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { MaterialCategory } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/materials/:id
 * Get a single material by ID
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const material = await prisma.material.findFirst({
    where: {
      id,
      orgId: auth.orgId,
    },
    include: {
      _count: {
        select: { usages: true },
      },
      usages: {
        take: 10,
        orderBy: { addedAt: "desc" },
        include: {
          taskInstance: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!material) {
    return jsonError("Material not found.", 404);
  }

  return NextResponse.json({ data: material });
}

/**
 * PATCH /api/materials/:id
 * Update a material
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Check permissions
  if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
    return jsonError("Only administrators can update materials.", 403);
  }

  const body = await request.json();
  const { name, partNumber, manufacturer, unitCost, unit, category, isActive } = body;

  // Verify material exists and belongs to org
  const existing = await prisma.material.findFirst({
    where: { id, orgId: auth.orgId },
  });

  if (!existing) {
    return jsonError("Material not found.", 404);
  }

  // Build update data
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (partNumber !== undefined) updateData.partNumber = partNumber;
  if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
  if (unitCost !== undefined) updateData.unitCost = unitCost ? parseFloat(unitCost) : null;
  if (unit !== undefined) updateData.unit = unit;
  if (category !== undefined && Object.values(MaterialCategory).includes(category as MaterialCategory)) {
    updateData.category = category;
  }
  if (isActive !== undefined) updateData.isActive = isActive;

  const material = await prisma.material.update({
    where: { id },
    data: updateData,
    include: {
      _count: {
        select: { usages: true },
      },
    },
  });

  return NextResponse.json({ data: material });
}

/**
 * DELETE /api/materials/:id
 * Soft delete a material (set isActive = false)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Check permissions
  if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
    return jsonError("Only administrators can delete materials.", 403);
  }

  // Verify material exists
  const existing = await prisma.material.findFirst({
    where: { id, orgId: auth.orgId },
  });

  if (!existing) {
    return jsonError("Material not found.", 404);
  }

  // Soft delete - set isActive to false
  const material = await prisma.material.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ data: material });
}
