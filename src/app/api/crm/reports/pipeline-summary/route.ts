import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// GET /api/crm/reports/pipeline-summary — pipeline summary report
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  const { searchParams } = new URL(request.url);
  const now = new Date();

  // Default to current month if not provided
  const startDate = searchParams.get("startDate")
    ? new Date(searchParams.get("startDate")!)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = searchParams.get("endDate")
    ? new Date(searchParams.get("endDate")!)
    : now;
  const userIdParam = searchParams.get("userId");

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return jsonError("Invalid date format. Use ISO date strings.");
  }

  // SALES sees own only; ADMIN can filter by userId
  const isSales = auth.role === Role.SALES;
  const effectiveUserId = isSales ? auth.userId : userIdParam ?? undefined;

  const baseWhere: any = {
    orgId: auth.orgId,
    createdAt: { gte: startDate, lte: endDate },
  };
  if (effectiveUserId) baseWhere.createdByUserId = effectiveUserId;

  const [byStage, pipelineAgg, allAgg, totalOpportunities] = await Promise.all(
    [
      // Group by status (stage)
      prisma.opportunity.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: { _all: true },
        _sum: { amount: true },
      }),

      // Total pipeline value (non-WON/LOST)
      prisma.opportunity.aggregate({
        where: {
          ...baseWhere,
          status: { notIn: ["WON", "LOST"] },
        },
        _sum: { amount: true },
      }),

      // Average deal size (all opportunities in range)
      prisma.opportunity.aggregate({
        where: baseWhere,
        _avg: { amount: true },
      }),

      // Total count
      prisma.opportunity.count({ where: baseWhere }),
    ]
  );

  return NextResponse.json({
    data: {
      byStage: byStage.map((row) => ({
        status: row.status,
        count: row._count._all,
        totalAmount: row._sum.amount ?? 0,
      })),
      totalPipelineValue: pipelineAgg._sum.amount ?? 0,
      avgDealSize: allAgg._avg.amount ?? 0,
      totalOpportunities,
    },
  });
}
