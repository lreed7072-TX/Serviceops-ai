import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// GET /api/crm/reports/follow-up-performance — follow-up performance report
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

  // Base where for this org
  const baseWhere: any = { orgId: auth.orgId };
  if (effectiveUserId) baseWhere.assignedToUserId = effectiveUserId;

  const [open, overdue, completed, completedFollowUps, byRepGrouped] =
    await Promise.all([
      // Open (PENDING) follow-ups
      prisma.followUp.count({
        where: { ...baseWhere, status: "PENDING" },
      }),

      // Overdue follow-ups (PENDING and past due)
      prisma.followUp.count({
        where: { ...baseWhere, status: "PENDING", dueDate: { lt: now } },
      }),

      // Completed in date range
      prisma.followUp.count({
        where: {
          ...baseWhere,
          status: "COMPLETED",
          completedAt: { gte: startDate, lte: endDate },
        },
      }),

      // Completed follow-ups with dates for avg completion days
      prisma.followUp.findMany({
        where: {
          ...baseWhere,
          status: "COMPLETED",
          completedAt: { gte: startDate, lte: endDate, not: null },
        },
        select: { createdAt: true, completedAt: true },
      }),

      // Group by rep for by-rep breakdown
      prisma.followUp.groupBy({
        by: ["assignedToUserId", "status"],
        where: {
          orgId: auth.orgId,
          ...(effectiveUserId
            ? { assignedToUserId: effectiveUserId }
            : {}),
        },
        _count: { _all: true },
      }),
    ]);

  // Calculate average completion days
  let avgCompletionDays = 0;
  if (completedFollowUps.length > 0) {
    const totalDays = completedFollowUps.reduce((sum, fu) => {
      if (!fu.completedAt) return sum;
      const diffMs = fu.completedAt.getTime() - fu.createdAt.getTime();
      return sum + diffMs / (1000 * 60 * 60 * 24);
    }, 0);
    avgCompletionDays = Math.round((totalDays / completedFollowUps.length) * 10) / 10;
  }

  // Build by-rep breakdown with user names
  const repMap = new Map<
    string,
    { open: number; completed: number }
  >();
  for (const row of byRepGrouped) {
    const userId = row.assignedToUserId;
    if (!repMap.has(userId)) repMap.set(userId, { open: 0, completed: 0 });
    const entry = repMap.get(userId)!;
    if (row.status === "PENDING") entry.open += row._count._all;
    if (row.status === "COMPLETED") entry.completed += row._count._all;
  }

  // Resolve user names
  const repUserIds = Array.from(repMap.keys());
  const users =
    repUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: repUserIds }, orgId: auth.orgId },
          select: { id: true, name: true },
        })
      : [];
  const userNameMap = new Map(users.map((u) => [u.id, u.name ?? "Unknown"]));

  const byRep = repUserIds.map((userId) => ({
    userId,
    name: userNameMap.get(userId) ?? "Unknown",
    ...repMap.get(userId)!,
  }));

  return NextResponse.json({
    data: {
      open,
      overdue,
      completed,
      avgCompletionDays,
      byRep,
    },
  });
}
