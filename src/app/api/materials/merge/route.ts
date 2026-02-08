import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/materials/merge - Merge duplicate materials into a primary record
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { primaryId, duplicateIds } = body as {
    primaryId: string;
    duplicateIds: string[];
  };

  if (!primaryId || !duplicateIds?.length) {
    return NextResponse.json(
      { error: "primaryId and duplicateIds are required" },
      { status: 400 }
    );
  }

  // Verify all materials belong to org
  const materials = await prisma.material.findMany({
    where: {
      id: { in: [primaryId, ...duplicateIds] },
      orgId: auth.orgId,
    },
    include: {
      _count: {
        select: {
          usages: true,
          quoteLineItems: true,
          stockMovements: true,
        },
      },
    },
  });

  const primary = materials.find((m) => m.id === primaryId);
  if (!primary) {
    return NextResponse.json({ error: "Primary material not found" }, { status: 404 });
  }

  const dupes = materials.filter((m) => duplicateIds.includes(m.id));
  if (dupes.length !== duplicateIds.length) {
    return NextResponse.json(
      { error: "Some duplicate materials were not found" },
      { status: 404 }
    );
  }

  // Perform merge in a transaction
  const result = await prisma.$transaction(async (tx) => {
    let usagesUpdated = 0;
    let quoteItemsUpdated = 0;
    let stockMovementsUpdated = 0;
    let totalQuantityAdded = 0;

    for (const dupe of dupes) {
      // 1. Update TaskMaterialUsage references
      const usageResult = await tx.taskMaterialUsage.updateMany({
        where: { materialId: dupe.id, orgId: auth.orgId },
        data: { materialId: primaryId },
      });
      usagesUpdated += usageResult.count;

      // 2. Update QuoteLineItem references
      const quoteResult = await tx.quoteLineItem.updateMany({
        where: { materialId: dupe.id, orgId: auth.orgId },
        data: { materialId: primaryId },
      });
      quoteItemsUpdated += quoteResult.count;

      // 3. Update StockMovement references
      const stockResult = await tx.stockMovement.updateMany({
        where: { materialId: dupe.id, orgId: auth.orgId },
        data: { materialId: primaryId },
      });
      stockMovementsUpdated += stockResult.count;

      // 4. Accumulate stock quantities
      totalQuantityAdded += Number(dupe.quantityOnHand);

      // 5. Delete duplicate material
      await tx.material.delete({ where: { id: dupe.id } });
    }

    // 6. Update primary material stock quantity
    if (totalQuantityAdded > 0) {
      await tx.material.update({
        where: { id: primaryId },
        data: {
          quantityOnHand: {
            increment: totalQuantityAdded,
          },
        },
      });
    }

    return {
      usagesUpdated,
      quoteItemsUpdated,
      stockMovementsUpdated,
      duplicatesRemoved: dupes.length,
    };
  });

  return NextResponse.json({
    data: result,
    message: `Merged ${result.duplicatesRemoved} duplicate(s) into primary material`,
  });
}
