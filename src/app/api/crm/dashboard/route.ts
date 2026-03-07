import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// GET /api/crm/dashboard — aggregated CRM stats
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  const now = new Date();

  // Monday of current week (ISO week starts Monday)
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  // Start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Base filters: SALES sees own data only, ADMIN sees all
  const isSales = auth.role === Role.SALES;

  const callWhere: any = { orgId: auth.orgId };
  if (isSales) callWhere.userId = auth.userId;

  const followUpWhere: any = { orgId: auth.orgId };
  if (isSales) followUpWhere.assignedToUserId = auth.userId;

  const opportunityWhere: any = { orgId: auth.orgId };
  if (isSales) opportunityWhere.createdByUserId = auth.userId;

  const ticketWhere: any = { orgId: auth.orgId };
  if (isSales) ticketWhere.createdByUserId = auth.userId;

  const [
    callsThisWeek,
    callsThisMonth,
    openFollowUps,
    overdueFollowUps,
    pipelineAgg,
    openOpportunities,
    openServiceTickets,
    recentCalls,
    pipelineByStage,
  ] = await Promise.all([
    // Calls this week
    prisma.callLog.count({
      where: { ...callWhere, callTimestamp: { gte: weekStart } },
    }),

    // Calls this month
    prisma.callLog.count({
      where: { ...callWhere, callTimestamp: { gte: monthStart } },
    }),

    // Open follow-ups
    prisma.followUp.count({
      where: { ...followUpWhere, status: "PENDING" },
    }),

    // Overdue follow-ups
    prisma.followUp.count({
      where: { ...followUpWhere, status: "PENDING", dueDate: { lt: now } },
    }),

    // Pipeline value (sum of non-WON/LOST opportunities)
    prisma.opportunity.aggregate({
      where: {
        ...opportunityWhere,
        status: { notIn: ["WON", "LOST"] },
      },
      _sum: { amount: true },
    }),

    // Open opportunities count
    prisma.opportunity.count({
      where: {
        ...opportunityWhere,
        status: { notIn: ["WON", "LOST"] },
      },
    }),

    // Open service tickets
    prisma.serviceTicket.count({
      where: { ...ticketWhere, status: "OPEN" },
    }),

    // Recent 10 calls
    prisma.callLog.findMany({
      where: callWhere,
      orderBy: { callTimestamp: "desc" },
      take: 10,
      select: {
        id: true,
        callTimestamp: true,
        notes: true,
        customer: { select: { name: true } },
        callOutcome: { select: { name: true } },
        user: { select: { name: true } },
      },
    }),

    // Pipeline grouped by stage
    prisma.opportunity.groupBy({
      by: ["status"],
      where: opportunityWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  // Check for overdue follow-ups and create notifications
  try {
    const overdueFollowUpsList = await prisma.followUp.findMany({
      where: {
        orgId: auth.orgId,
        status: "PENDING",
        dueDate: { lt: now },
        reminderSent: false,
      },
      select: {
        id: true,
        assignedToUserId: true,
        title: true,
        customer: { select: { name: true } },
      },
    });

    if (overdueFollowUpsList.length > 0) {
      await prisma.notification.createMany({
        data: overdueFollowUpsList.map((fu) => ({
          userId: fu.assignedToUserId,
          orgId: auth.orgId,
          type: "FOLLOW_UP_OVERDUE",
          title: "Follow-up Overdue",
          message: `"${fu.title}" for ${fu.customer?.name || "a customer"} is overdue`,
          actionUrl: `/sales/follow-ups`,
        })),
      });

      // Mark as reminded so we don't spam
      await prisma.followUp.updateMany({
        where: { id: { in: overdueFollowUpsList.map((fu) => fu.id) } },
        data: { reminderSent: true },
      });
    }
  } catch (notifError) {
    console.error("Failed to create overdue follow-up notifications:", notifError);
  }

  return NextResponse.json({
    data: {
      callsThisWeek,
      callsThisMonth,
      openFollowUps,
      overdueFollowUps,
      pipelineValue: pipelineAgg._sum.amount ?? 0,
      openOpportunities,
      openServiceTickets,
      recentCalls,
      pipelineByStage: pipelineByStage.map((row) => ({
        status: row.status,
        count: row._count._all,
        totalAmount: row._sum.amount ?? 0,
      })),
    },
  });
}
