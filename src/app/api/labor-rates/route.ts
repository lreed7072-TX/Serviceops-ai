import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { Role } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export const runtime = "nodejs";

/**
 * GET /api/labor-rates
 * List all labor rates for the org
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const rates = await prisma.laborRateConfig.findMany({
    where: { orgId: authResult.auth.orgId },
    orderBy: { role: "asc" },
  });

  return NextResponse.json({ data: rates });
}

/**
 * POST /api/labor-rates
 * Create or update a labor rate
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Only admins can manage labor rates
  if (authResult.auth.role !== Role.ADMIN) {
    return jsonError("Only admins can manage labor rates.", 403);
  }

  const body = await parseJson(request);
  
  if (!body?.role || body.hourlyRate === undefined) {
    return jsonError("role and hourlyRate are required.", 400);
  }

  // Check if rate already exists for this role
  const existing = await prisma.laborRateConfig.findUnique({
    where: {
      orgId_role: {
        orgId: authResult.auth.orgId,
        role: body.role,
      },
    },
  });

  if (existing) {
    // Update existing rate
    const updated = await prisma.laborRateConfig.update({
      where: { id: existing.id },
      data: {
        hourlyRate: new Decimal(body.hourlyRate),
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });
    return NextResponse.json({ data: updated });
  } else {
    // Create new rate
    const rate = await prisma.laborRateConfig.create({
      data: {
        orgId: authResult.auth.orgId,
        role: body.role,
        hourlyRate: new Decimal(body.hourlyRate),
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });
    return NextResponse.json({ data: rate }, { status: 201 });
  }
}
