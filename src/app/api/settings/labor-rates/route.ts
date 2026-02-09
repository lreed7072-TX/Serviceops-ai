import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/settings/labor-rates
 * List all named labor rates for the org
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;

    const rates = await prisma.laborRate.findMany({
      where: { orgId: authResult.auth.orgId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: rates });
  } catch (error) {
    console.error("Get labor rates error:", error);
    return NextResponse.json(
      { error: "Failed to load labor rates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/labor-rates
 * Create a new named labor rate
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN"]);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const { name, description, hourlyRate, isDefault } = body;

    if (!name || hourlyRate === undefined) {
      return NextResponse.json(
        { error: "Name and hourly rate are required" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.laborRate.updateMany({
        where: { orgId: auth.orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const rate = await prisma.laborRate.create({
      data: {
        orgId: auth.orgId,
        name: name.trim(),
        description: description?.trim() || null,
        hourlyRate: parseFloat(hourlyRate),
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ data: rate }, { status: 201 });
  } catch (error) {
    console.error("Create labor rate error:", error);
    return NextResponse.json(
      { error: "Failed to create labor rate" },
      { status: 500 }
    );
  }
}
