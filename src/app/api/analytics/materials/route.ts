import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/analytics/materials - Material usage and cost analytics
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get material usages for period
    const usages = await prisma.taskMaterialUsage.findMany({
      where: {
        orgId: auth.orgId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        materialId: true,
        name: true,
        partNumber: true,
        quantity: true,
        unitCost: true,
        totalCost: true,
        material: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    // Most used materials
    const materialUsageMap = usages.reduce((acc: any[], usage) => {
      const materialId = usage.materialId || usage.name;
      const existing = acc.find((item) => item.materialId === materialId);
      
      if (existing) {
        existing.usageCount += 1;
        existing.totalQuantity += usage.quantity;
        existing.totalCost += usage.totalCost || 0;
      } else {
        acc.push({
          materialId,
          materialName: usage.material?.name || usage.name,
          category: usage.material?.category || "OTHER",
          usageCount: 1,
          totalQuantity: usage.quantity,
          totalCost: usage.totalCost || 0,
        });
      }
      return acc;
    }, []);

    materialUsageMap.sort((a, b) => b.usageCount - a.usageCount);

    // Category distribution
    const categoryDistribution = materialUsageMap.reduce((acc: any, item) => {
      if (!acc[item.category]) {
        acc[item.category] = {
          count: 0,
          totalCost: 0,
        };
      }
      acc[item.category].count += item.usageCount;
      acc[item.category].totalCost += item.totalCost;
      return acc;
    }, {});

    // Total material costs
    const totalMaterialCost = usages.reduce((sum, usage) => sum + (usage.totalCost || 0), 0);

    // Get current inventory status
    const materials = await prisma.material.findMany({
      where: {
        orgId: auth.orgId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        quantityOnHand: true,
        minQuantity: true,
        unitCost: true,
      },
    });

    // Low stock count
    const lowStockCount = materials.filter((m) => {
      if (!m.minQuantity) return false;
      return m.quantityOnHand.toNumber() < m.minQuantity.toNumber();
    }).length;

    // Total inventory value
    const inventoryValue = materials.reduce((sum, material) => {
      const qty = material.quantityOnHand.toNumber();
      const cost = material.unitCost || 0;
      return sum + qty * cost;
    }, 0);

    // Monthly usage trend
    const monthlyUsage = usages.reduce((acc: any[], usage) => {
      const month = new Date(usage.createdAt).toISOString().slice(0, 7);
      const existing = acc.find((item) => item.month === month);
      
      if (existing) {
        existing.usageCount += 1;
        existing.totalCost += usage.totalCost || 0;
      } else {
        acc.push({
          month,
          usageCount: 1,
          totalCost: usage.totalCost || 0,
        });
      }
      return acc;
    }, []);

    monthlyUsage.sort((a, b) => a.month.localeCompare(b.month));

    return jsonResponse({
      data: {
        summary: {
          totalUsages: usages.length,
          totalMaterialCost,
          uniqueMaterialsUsed: materialUsageMap.length,
          lowStockCount,
          inventoryValue,
        },
        topMaterials: materialUsageMap.slice(0, 15),
        categoryDistribution,
        monthlyTrend: monthlyUsage,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/analytics/materials error:", error);
    return jsonError("Failed to fetch material analytics", 500);
  }
}
