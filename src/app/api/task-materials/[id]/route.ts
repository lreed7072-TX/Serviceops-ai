import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// PATCH /api/task-materials/[id] - Update material usage
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;
    const body = await request.json();
    const { quantity, unitCost, notes } = body;

    // Verify material usage belongs to org
    const existing = await prisma.taskMaterialUsage.findUnique({
      where: { id },
      select: { orgId: true, quantity: true, materialId: true },
    });

    if (!existing || existing.orgId !== auth.orgId) {
      return jsonError("Material usage not found", 404);
    }

    const updates: any = {};
    if (quantity !== undefined) {
      updates.quantity = quantity;
      // Recalculate total cost if quantity changes
      if (unitCost !== undefined) {
        updates.totalCost = quantity * unitCost;
      }
    }
    if (unitCost !== undefined) {
      updates.unitCost = unitCost;
      // Recalculate total cost
      const finalQuantity = quantity ?? existing.quantity;
      updates.totalCost = finalQuantity * unitCost;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }

    // Update inventory if quantity changed and material is from catalog
    if (quantity !== undefined && existing.materialId) {
      const quantityDiff = quantity - existing.quantity;
      if (quantityDiff !== 0) {
        await prisma.material.update({
          where: { id: existing.materialId },
          data: {
            quantityOnHand: {
              decrement: quantityDiff, // Positive diff = more used, negative = return
            },
          },
        });
      }
    }

    const updated = await prisma.taskMaterialUsage.update({
      where: { id },
      data: updates,
      include: {
        material: {
          select: {
            id: true,
            name: true,
            partNumber: true,
          },
        },
      },
    });

    return jsonResponse({ data: updated });
  } catch (error) {
    console.error("Failed to update task material:", error);
    return jsonError("Failed to update material", 500);
  }
}

// DELETE /api/task-materials/[id] - Remove material from task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    // Verify material usage belongs to org
    const existing = await prisma.taskMaterialUsage.findUnique({
      where: { id },
      select: { orgId: true, quantity: true, materialId: true },
    });

    if (!existing || existing.orgId !== auth.orgId) {
      return jsonError("Material usage not found", 404);
    }

    // Return to inventory if material is from catalog
    if (existing.materialId) {
      await prisma.material.update({
        where: { id: existing.materialId },
        data: {
          quantityOnHand: {
            increment: existing.quantity, // Return the quantity
          },
        },
      });
    }

    await prisma.taskMaterialUsage.delete({
      where: { id },
    });

    return jsonResponse({ success: true, message: "Material removed" });
  } catch (error) {
    console.error("Failed to delete task material:", error);
    return jsonError("Failed to delete material", 500);
  }
}
