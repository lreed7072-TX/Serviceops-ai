// Material Catalog Management API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { MaterialCategory } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/materials
 * List all materials for the organization with search/filter
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") as MaterialCategory | null;
  const isActive = searchParams.get("isActive");

  // Build where clause
  const where: any = {
    orgId: auth.orgId,
  };

  // Search across name, part number, manufacturer
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { partNumber: { contains: search, mode: "insensitive" } },
      { manufacturer: { contains: search, mode: "insensitive" } },
    ];
  }

  // Filter by category
  if (category && Object.values(MaterialCategory).includes(category)) {
    where.category = category;
  }

  // Filter by active status
  if (isActive !== null) {
    where.isActive = isActive === "true";
  }

  const materials = await prisma.material.findMany({
    where,
    orderBy: [
      { isActive: "desc" }, // Active first
      { name: "asc" },
    ],
    include: {
      _count: {
        select: { usages: true },
      },
    },
  });

  return NextResponse.json({ data: materials });
}

/**
 * POST /api/materials
 * Create a new material in the catalog
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Check permissions - only admin/dispatcher can create materials
  if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
    return jsonError("Only administrators can create materials.", 403);
  }

  const body = await request.json();
  const { name, partNumber, manufacturer, unitCost, unit, category } = body;

  // Validate required fields
  if (!name) {
    return jsonError("Material name is required.", 400);
  }

  // Create material
  const material = await prisma.material.create({
    data: {
      orgId: auth.orgId,
      name,
      partNumber: partNumber || null,
      manufacturer: manufacturer || null,
      unitCost: unitCost ? parseFloat(unitCost) : null,
      unit: unit || null,
      category: category || MaterialCategory.PART,
      isActive: true,
    },
    include: {
      _count: {
        select: { usages: true },
      },
    },
  });

  return NextResponse.json({ data: material }, { status: 201 });
}
