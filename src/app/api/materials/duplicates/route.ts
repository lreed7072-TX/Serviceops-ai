import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/materials/duplicates - Find duplicate materials by name + partNumber
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Only ADMIN can view duplicates
  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const duplicates: any[] = await prisma.$queryRaw`
    SELECT
      LOWER(TRIM(name)) as normalized_name,
      COALESCE("partNumber", '') as part_number,
      COUNT(*)::int as count,
      ARRAY_AGG(id) as ids,
      ARRAY_AGG(name) as names,
      ARRAY_AGG("unitCost") as costs,
      ARRAY_AGG("manufacturer") as manufacturers,
      ARRAY_AGG("quantityOnHand"::float) as quantities,
      ARRAY_AGG("isActive") as active_flags
    FROM "Material"
    WHERE "orgId" = ${auth.orgId}::uuid
    GROUP BY LOWER(TRIM(name)), COALESCE("partNumber", '')
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  return NextResponse.json({ data: duplicates });
}
