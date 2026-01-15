import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// GET /api/dashboard/stats - Get dashboard metrics
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  try {
    // Work Orders Stats
    const workOrders = await prisma.workOrder.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { id: true },
    });

    const workOrdersByType = await prisma.workOrder.groupBy({
      by: ['orderType'],
      where: { orgId },
      _count: { id: true },
    });

    const woTotal = workOrders.reduce((sum, g) => sum + g._count.id, 0);
    const woOpen = workOrders.find(g => g.status === 'OPEN')?._count.id || 0;
    const woInProgress = workOrders.find(g => g.status === 'IN_PROGRESS')?._count.id || 0;
    const woCompleted = workOrders.find(g => g.status === 'COMPLETED')?._count.id || 0;

    // Quotes Stats
    const quotes = await prisma.quote.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { id: true },
      _sum: { total: true },
    });

    const quotesTotal = quotes.reduce((sum, g) => sum + g._count.id, 0);
    const quotesDraft = quotes.find(g => g.status === 'DRAFT')?._count.id || 0;
    const quotesSent = quotes.find(g => g.status === 'SENT')?._count.id || 0;
    const quotesApproved = quotes.find(g => g.status === 'APPROVED')?._count.id || 0;
    const pendingValue = quotes.find(g => g.status === 'SENT')?._sum.total || 0;
    const approvedValue = quotes.find(g => g.status === 'APPROVED')?._sum.total || 0;

    // Revenue Stats (invoicing)
    const invoices = await prisma.invoice.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { id: true },
      _sum: { total: true },
    });

    const invoicesTotal = invoices.reduce((sum, g) => sum + g._count.id, 0);
    const invoicesDraft = invoices.find(g => g.status === 'DRAFT')?._count.id || 0;
    const invoicesSent = invoices.find(g => g.status === 'SENT')?._count.id || 0;
    const invoicesPaid = invoices.find(g => g.status === 'PAID')?._count.id || 0;
    const invoicesOverdue = invoices.find(g => g.status === 'OVERDUE')?._count.id || 0;
    
    const totalBilled = invoices.reduce((sum, g) => sum + Number(g._sum.total || 0), 0);
    const paidRevenue = invoices.find(g => g.status === 'PAID')?._sum.total || 0;
    const pendingRevenue = invoices.filter(g => g.status === 'SENT' || g.status === 'OVERDUE')
      .reduce((sum, g) => sum + Number(g._sum.total || 0), 0);

    // This month invoiced (created this month)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const invoicesThisMonth = await prisma.invoice.aggregate({
      where: {
        orgId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { total: true },
    });

    const thisMonthInvoiced = Number(invoicesThisMonth._sum.total || 0);

    // Completed work orders (legacy stat)
    const completedWOs = await prisma.workOrder.findMany({
      where: { orgId, status: 'COMPLETED' },
      select: { id: true },
    });

    // Sum up line items from converted quotes for completed work
    let completedWorkValue = 0;
    for (const wo of completedWOs) {
      const sourceQuote = await prisma.quote.findFirst({
        where: { convertedToOrderId: wo.id },
        select: { total: true },
      });
      if (sourceQuote?.total) {
        completedWorkValue += Number(sourceQuote.total);
      }
    }

    // Technician Stats
    const technicianCount = await prisma.user.count({
      where: { orgId, role: 'TECH' },
    });

    // Active today (techs with running or stopped timers today)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const activeTodayTimers = await prisma.timeEntry.findMany({
      where: {
        orgId,
        startedAt: { gte: startOfDay },
      },
      distinct: ['userId'],
      select: { userId: true },
    });

    // Hours this week (sum of time entry durations)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const timersThisWeek = await prisma.timeEntry.findMany({
      where: {
        orgId,
        startedAt: { gte: startOfWeek },
      },
      select: { 
        accumulatedSeconds: true,
        startedAt: true,
        stoppedAt: true,
        pausedAt: true,
        status: true,
      },
    });

    // Calculate total hours including running timers
    const now = new Date();
    let totalSecondsThisWeek = 0;
    
    for (const timer of timersThisWeek) {
      let seconds = timer.accumulatedSeconds || 0;
      
      // If timer is still running, add time since startedAt
      if (timer.status === 'RUNNING' && timer.startedAt) {
        const runningSince = timer.pausedAt || timer.startedAt;
        const runningSeconds = Math.floor((now.getTime() - runningSince.getTime()) / 1000);
        seconds += runningSeconds;
      }
      
      totalSecondsThisWeek += seconds;
    }
    
    const totalHoursThisWeek = totalSecondsThisWeek / 3600;

    // Recent Activity (last 10 items)
    const recentWOs = await prisma.workOrder.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        workOrderNumber: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    });

    const recentQuotes = await prisma.quote.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    });

    const recentActivity = [
      ...recentWOs.map(wo => ({
        id: wo.id,
        type: 'WORK_ORDER' as const,
        description: `Work Order ${wo.workOrderNumber} - ${wo.customer.name} (${wo.status})`,
        timestamp: wo.createdAt.toISOString(),
      })),
      ...recentQuotes.map(q => ({
        id: q.id,
        type: 'QUOTE' as const,
        description: `Quote ${q.quoteNumber} - ${q.customer.name} (${q.status})`,
        timestamp: q.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    // AI & Task Stats
    const aiTaskPlans = await prisma.aITaskPlan.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { id: true },
    });

    const aiGenerated = aiTaskPlans.find(g => g.status === 'GENERATED')?._count.id || 0;
    const aiApproved = aiTaskPlans.find(g => g.status === 'APPROVED')?._count.id || 0;
    const aiRejected = aiTaskPlans.find(g => g.status === 'REJECTED')?._count.id || 0;

    const allTasks = await prisma.taskInstance.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { id: true },
    });

    const totalTasks = allTasks.reduce((sum, g) => sum + g._count.id, 0);
    const tasksTodo = allTasks.find(g => g.status === 'TODO')?._count.id || 0;
    const tasksInProgress = allTasks.find(g => g.status === 'IN_PROGRESS')?._count.id || 0;
    const tasksDone = allTasks.find(g => g.status === 'DONE')?._count.id || 0;
    const tasksBlocked = allTasks.find(g => g.status === 'BLOCKED')?._count.id || 0;

    const completionRate = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;

    // Package Stats
    const packages = await prisma.workPackage.groupBy({
      by: ['packageType'],
      where: { orgId },
      _count: { id: true },
    });

    const totalPackages = packages.reduce((sum, g) => sum + g._count.id, 0);

    const stats = {
      workOrders: {
        total: woTotal,
        open: woOpen,
        inProgress: woInProgress,
        completed: woCompleted,
        byType: workOrdersByType.map(g => ({
          type: g.orderType || 'WORK_ORDER',
          count: g._count.id,
        })),
      },
      quotes: {
        total: quotesTotal,
        draft: quotesDraft,
        sent: quotesSent,
        approved: quotesApproved,
        pendingValue: Number(pendingValue),
        approvedValue: Number(approvedValue),
      },
      revenue: {
        completedWorkValue,
        thisMonthInvoiced,
        totalBilled,
        paidRevenue: Number(paidRevenue),
        pendingRevenue,
      },
      invoices: {
        total: invoicesTotal,
        draft: invoicesDraft,
        sent: invoicesSent,
        paid: invoicesPaid,
        overdue: invoicesOverdue,
      },
      technicians: {
        total: technicianCount,
        activeToday: activeTodayTimers.length,
        totalHoursThisWeek,
      },
      ai: {
        generated: aiGenerated,
        approved: aiApproved,
        rejected: aiRejected,
      },
      tasks: {
        total: totalTasks,
        todo: tasksTodo,
        inProgress: tasksInProgress,
        done: tasksDone,
        blocked: tasksBlocked,
        completionRate,
      },
      packages: {
        total: totalPackages,
        byType: packages.map(g => ({
          type: g.packageType,
          count: g._count.id,
        })),
      },
      recentActivity,
    };

    return NextResponse.json({ data: stats });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard stats' },
      { status: 500 }
    );
  }
}
