import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/ai/stats
 * Admin-only AI usage statistics.
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const [insightsByType, jobsByStatus, recentInsights, tokenUsage] =
    await Promise.all([
      // Insights grouped by type
      prisma.aiInsight.groupBy({
        by: ["insightType"],
        where: { orgId: auth.orgId },
        _count: { insightType: true },
      }),

      // Jobs grouped by status
      prisma.aiInsightJob.groupBy({
        by: ["status"],
        where: { orgId: auth.orgId },
        _count: { status: true },
      }),

      // Recent 10 insights
      prisma.aiInsight.findMany({
        where: { orgId: auth.orgId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          insightType: true,
          severity: true,
          title: true,
          summary: true,
          createdAt: true,
          tokensUsed: true,
        },
      }),

      // Total tokens used
      prisma.aiInsight.aggregate({
        where: { orgId: auth.orgId },
        _sum: { tokensUsed: true },
      }),
    ]);

  return NextResponse.json({
    data: {
      insightsByType: insightsByType.map((g) => ({
        type: g.insightType,
        count: g._count.insightType,
      })),
      jobsByStatus: jobsByStatus.map((g) => ({
        status: g.status,
        count: g._count.status,
      })),
      recentInsights,
      totalTokensUsed: tokenUsage._sum.tokensUsed ?? 0,
    },
  });
}
