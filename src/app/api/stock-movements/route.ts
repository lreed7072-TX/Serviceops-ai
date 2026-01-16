import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { StockMovementType } from "@prisma/client";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/stock-movements - List stock movements with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const auth = session.user as { id: string; orgId: string; role: string };
    const { searchParams } = new URL(request.url);
    
    const materialId = searchParams.get("materialId");
    const movementType = searchParams.get("movementType");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = { orgId: auth.orgId };
    if (materialId) where.materialId = materialId;
    if (movementType) where.movementType = movementType as StockMovementType;

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        material: {
          select: {
            id: true,
            name: true,
            partNumber: true,
            unit: true,
          },
        },
        performedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return jsonResponse({ data: movements });
  } catch (error) {
    console.error("GET /api/stock-movements error:", error);
    return jsonError("Failed to fetch stock movements", 500);
  }
}

// POST /api/stock-movements - Record a stock movement
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const auth = session.user as { id: string; orgId: string; role: string };
    const body = await request.json();

    const {
      materialId,
      movementType,
      quantity,
      unitCost,
      reference,
      notes,
    } = body;

    // Validation
    if (!materialId || !movementType || !quantity) {
      return jsonError("Missing required fields: materialId, movementType, quantity", 400);
    }

    if (quantity <= 0) {
      return jsonError("Quantity must be positive", 400);
    }

    // Get current material
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        orgId: true,
        quantityOnHand: true,
        name: true,
      },
    });

    if (!material) {
      return jsonError("Material not found", 404);
    }

    if (material.orgId !== auth.orgId) {
      return jsonError("Access denied", 403);
    }

    const currentQuantity = material.quantityOnHand.toNumber();
    let newQuantity: number;

    // Calculate new quantity based on movement type
    switch (movementType as StockMovementType) {
      case StockMovementType.PURCHASE:
      case StockMovementType.RETURN:
      case StockMovementType.ADJUSTMENT:
        // These increase stock (adjustment can be + or -)
        newQuantity = currentQuantity + quantity;
        break;
      case StockMovementType.USAGE:
      case StockMovementType.TRANSFER:
      case StockMovementType.WRITE_OFF:
        // These decrease stock
        newQuantity = currentQuantity - quantity;
        break;
      default:
        return jsonError("Invalid movement type", 400);
    }

    // Prevent negative stock
    if (newQuantity < 0) {
      return jsonError(`Insufficient stock. Current: ${currentQuantity}, Requested: ${quantity}`, 400);
    }

    const totalCost = unitCost ? quantity * unitCost : null;

    // Create movement and update material in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create stock movement record
      const movement = await tx.stockMovement.create({
        data: {
          orgId: auth.orgId,
          materialId,
          movementType: movementType as StockMovementType,
          quantity,
          quantityBefore: currentQuantity,
          quantityAfter: newQuantity,
          unitCost: unitCost || null,
          totalCost,
          reference: reference || null,
          notes: notes || null,
          performedByUserId: auth.id,
        },
        include: {
          material: {
            select: {
              id: true,
              name: true,
              partNumber: true,
            },
          },
          performedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Update material quantity
      const updateData: any = {
        quantityOnHand: newQuantity,
      };

      // Update lastRestocked for purchases
      if (movementType === StockMovementType.PURCHASE) {
        updateData.lastRestocked = new Date();
      }

      await tx.material.update({
        where: { id: materialId },
        data: updateData,
      });

      return movement;
    });

    return jsonResponse({ data: result }, 201);
  } catch (error) {
    console.error("POST /api/stock-movements error:", error);
    return jsonError("Failed to record stock movement", 500);
  }
}
