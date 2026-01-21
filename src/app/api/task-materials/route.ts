import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/task-materials - List materials for a task
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const taskInstanceId = searchParams.get("taskInstanceId");

    if (!taskInstanceId) {
      return jsonError("taskInstanceId required", 400);
    }

    // Verify task belongs to org
    const task = await prisma.taskInstance.findUnique({
      where: { id: taskInstanceId },
      select: { orgId: true },
    });

    if (!task || task.orgId !== auth.orgId) {
      return jsonError("Task not found", 404);
    }

    const materials = await prisma.taskMaterialUsage.findMany({
      where: {
        orgId: auth.orgId,
        taskInstanceId,
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            partNumber: true,
            category: true,
          },
        },
        addedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        addedAt: "desc",
      },
    });

    return jsonResponse({ data: materials });
  } catch (error) {
    console.error("Failed to fetch task materials:", error);
    return jsonError("Failed to fetch materials", 500);
  }
}

// POST /api/task-materials - Add material to task
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const body = await request.json();
    const {
      taskInstanceId,
      materialId, // Optional - from catalog
      name, // Required if materialId not provided
      partNumber,
      quantity,
      unitCost,
      unit,
      notes,
    } = body;

    if (!taskInstanceId) {
      return jsonError("taskInstanceId is required", 400);
    }

    if (!materialId && !name) {
      return jsonError("Either materialId or name is required", 400);
    }

    if (!quantity || quantity <= 0) {
      return jsonError("Valid quantity required", 400);
    }

    // Verify task belongs to org
    const task = await prisma.taskInstance.findUnique({
      where: { id: taskInstanceId },
      select: { orgId: true, workOrderId: true },
    });

    if (!task || task.orgId !== auth.orgId) {
      return jsonError("Task not found", 404);
    }

    // If materialId provided, get material details
    let materialData: any = {
      name: name || "",
      partNumber: partNumber || null,
      unit: unit || null,
      unitCost: unitCost || null,
    };

    if (materialId) {
      const catalogMaterial = await prisma.material.findUnique({
        where: { id: materialId, orgId: auth.orgId },
      });

      if (!catalogMaterial) {
        return jsonError("Material not found in catalog", 404);
      }

      // Use catalog values as defaults, but allow overrides
      materialData = {
        name: catalogMaterial.name,
        partNumber: catalogMaterial.partNumber,
        unit: catalogMaterial.unit || unit,
        unitCost: unitCost ?? catalogMaterial.unitCost,
      };
    }

    const finalUnitCost = materialData.unitCost || 0;
    const totalCost = finalUnitCost * quantity;

    // Create material usage
    const materialUsage = await prisma.taskMaterialUsage.create({
      data: {
        orgId: auth.orgId,
        taskInstanceId,
        materialId: materialId || null,
        name: materialData.name,
        partNumber: materialData.partNumber,
        quantity,
        unitCost: finalUnitCost,
        unit: materialData.unit,
        totalCost,
        notes: notes || null,
        addedByUserId: auth.userId,
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            partNumber: true,
            category: true,
          },
        },
        addedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Optionally deduct from inventory if materialId provided
    if (materialId) {
      await prisma.material.update({
        where: { id: materialId },
        data: {
          quantityOnHand: {
            decrement: quantity,
          },
        },
      });
    }

    return jsonResponse({ data: materialUsage }, 201);
  } catch (error) {
    console.error("Failed to create task material:", error);
    return jsonError("Failed to add material", 500);
  }
}
