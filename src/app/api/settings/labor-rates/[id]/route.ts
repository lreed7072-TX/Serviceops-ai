import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/settings/labor-rates/[id]
 * Update a named labor rate
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN"]);
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.laborRate.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Labor rate not found" },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults first
    if (body.isDefault === true) {
      await prisma.laborRate.updateMany({
        where: { orgId: auth.orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined)
      updateData.description = body.description?.trim() || null;
    if (body.hourlyRate !== undefined)
      updateData.hourlyRate = parseFloat(body.hourlyRate);
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;

    const updated = await prisma.laborRate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Update labor rate error:", error);
    return NextResponse.json(
      { error: "Failed to update labor rate" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/labor-rates/[id]
 * Delete a named labor rate
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN"]);
    if (roleCheck) return roleCheck;

    const { id } = await params;

    const existing = await prisma.laborRate.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Labor rate not found" },
        { status: 404 }
      );
    }

    await prisma.laborRate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete labor rate error:", error);
    return NextResponse.json(
      { error: "Failed to delete labor rate" },
      { status: 500 }
    );
  }
}
