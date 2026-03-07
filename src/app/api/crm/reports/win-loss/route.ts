import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// GET /api/crm/reports/win-loss — win/loss analysis report
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
    wonLostAt: { gte: startDate, lte: endDate },
  };
  if (effectiveUserId) baseWhere.createdByUserId = effectiveUserId;

  const [won, lost, wonValueAgg, lostOpportunities] = await Promise.all([
    // Won count
    prisma.opportunity.count({
      where: { ...baseWhere, status: "WON" },
    }),

    // Lost count
    prisma.opportunity.count({
      where: { ...baseWhere, status: "LOST" },
    }),

    // Won value
    prisma.opportunity.aggregate({
      where: { ...baseWhere, status: "WON" },
      _sum: { amount: true },
    }),

    // Lost opportunities with reasons for grouping
    prisma.opportunity.findMany({
      where: { ...baseWhere, status: "LOST" },
      select: { wonLostReason: true },
    }),
  ]);

  // Calculate win rate
  const totalDecided = won + lost;
  const winRate = totalDecided > 0 ? Math.round((won / totalDecided) * 1000) / 10 : 0;

  // Group lost reasons
  const reasonCounts = new Map<string, number>();
  for (const opp of lostOpportunities) {
    const reason = opp.wonLostReason || "No reason provided";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const lostReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    data: {
      won,
      lost,
      winRate,
      wonValue: wonValueAgg._sum.amount ?? 0,
      lostReasons,
    },
  });
}
