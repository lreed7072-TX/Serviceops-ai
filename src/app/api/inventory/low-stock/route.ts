import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/inventory/low-stock - Find materials below minimum quantity
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const auth = session.user as { id: string; orgId: string; role: string };

    // Find materials where stock is below minimum (and minimum is set)
    const lowStockMaterials = await prisma.material.findMany({
      where: {
        orgId: auth.orgId,
        isActive: true,
        minQuantity: { not: null },
        // Use raw query to compare Decimal fields
      },
      select: {
        id: true,
        name: true,
        partNumber: true,
        category: true,
        quantityOnHand: true,
        minQuantity: true,
        maxQuantity: true,
        unit: true,
        unitCost: true,
        location: true,
        lastRestocked: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Filter for materials actually below minimum
    const filtered = lowStockMaterials.filter((material) => {
      if (!material.minQuantity) return false;
      return material.quantityOnHand.toNumber() < material.minQuantity.toNumber();
    });

    // Add calculated fields
    const enriched = filtered.map((material) => {
      const onHand = material.quantityOnHand.toNumber();
      const min = material.minQuantity?.toNumber() || 0;
      const shortfall = min - onHand;
      
      return {
        ...material,
        shortfall,
        percentOfMin: min > 0 ? (onHand / min) * 100 : 0,
      };
    });

    return jsonResponse({ 
      data: enriched,
      count: enriched.length,
    });
  } catch (error) {
    console.error("GET /api/inventory/low-stock error:", error);
    return jsonError("Failed to fetch low stock materials", 500);
  }
}
