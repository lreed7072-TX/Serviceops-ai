import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// GET /api/crm/reports/call-activity — call activity report
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

  // Build where clause for Prisma queries
  const where: any = {
    orgId: auth.orgId,
    callTimestamp: { gte: startDate, lte: endDate },
  };
  if (effectiveUserId) where.userId = effectiveUserId;

  // Raw SQL for calls-by-day grouping
  const userFilter = effectiveUserId
    ? `AND "userId" = '${effectiveUserId}'::uuid`
    : "";

  const [callsByDay, callsByType, callsByOutcome, totalCalls, durationAgg] =
    await Promise.all([
      // Group by date
      prisma.$queryRawUnsafe<{ date: string; count: number }[]>(
        `SELECT DATE("callTimestamp") as date, COUNT(*)::int as count
         FROM "CallLog"
         WHERE "orgId" = $1::uuid
           AND "callTimestamp" BETWEEN $2 AND $3
           ${userFilter}
         GROUP BY DATE("callTimestamp")
         ORDER BY date`,
        auth.orgId,
        startDate,
        endDate
      ),

      // Group by call type
      prisma.callLog.groupBy({
        by: ["callTypeId"],
        where,
        _count: { _all: true },
      }),

      // Group by call outcome
      prisma.callLog.groupBy({
        by: ["callOutcomeId"],
        where,
        _count: { _all: true },
      }),

      // Total calls
      prisma.callLog.count({ where }),

      // Average duration
      prisma.callLog.aggregate({
        where,
        _avg: { callDuration: true },
      }),
    ]);

  // Resolve call type and outcome names
  const callTypeIds = callsByType.map((r) => r.callTypeId);
  const callOutcomeIds = callsByOutcome.map((r) => r.callOutcomeId);

  const [callTypes, callOutcomes] = await Promise.all([
    callTypeIds.length > 0
      ? prisma.callType.findMany({
          where: { id: { in: callTypeIds }, orgId: auth.orgId },
          select: { id: true, name: true },
        })
      : [],
    callOutcomeIds.length > 0
      ? prisma.callOutcome.findMany({
          where: { id: { in: callOutcomeIds }, orgId: auth.orgId },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const typeNameMap = new Map(callTypes.map((t) => [t.id, t.name]));
  const outcomeNameMap = new Map(callOutcomes.map((o) => [o.id, o.name]));

  return NextResponse.json({
    data: {
      callsByDay,
      callsByType: callsByType.map((r) => ({
        callTypeId: r.callTypeId,
        name: typeNameMap.get(r.callTypeId) ?? "Unknown",
        count: r._count._all,
      })),
      callsByOutcome: callsByOutcome.map((r) => ({
        callOutcomeId: r.callOutcomeId,
        name: outcomeNameMap.get(r.callOutcomeId) ?? "Unknown",
        count: r._count._all,
      })),
      totalCalls,
      avgDuration: durationAgg._avg.callDuration ?? 0,
    },
  });
}
