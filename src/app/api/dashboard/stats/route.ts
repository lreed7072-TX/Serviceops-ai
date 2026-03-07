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
    // Pre-compute date boundaries
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Run ALL independent queries in parallel (was 15+ sequential)
    const [
      workOrders,
      workOrdersByType,
      quotes,
      invoices,
      invoicesThisMonth,
      completedWOs,
      technicianCount,
      activeTodayTimers,
      timersThisWeek,
      recentWOs,
      recentQuotes,
      aiTaskPlans,
      allTasks,
      packages,
      revenueByMonth,
      customerRevenue,
    ] = await Promise.all([
      prisma.workOrder.groupBy({ by: ['status'], where: { orgId }, _count: { id: true } }),
      prisma.workOrder.groupBy({ by: ['orderType'], where: { orgId }, _count: { id: true } }),
      prisma.quote.groupBy({ by: ['status'], where: { orgId }, _count: { id: true }, _sum: { total: true } }),
      prisma.invoice.groupBy({ by: ['status'], where: { orgId }, _count: { id: true }, _sum: { total: true } }),
      prisma.invoice.aggregate({ where: { orgId, createdAt: { gte: startOfMonth } }, _sum: { total: true } }),
      prisma.workOrder.findMany({ where: { orgId, status: 'COMPLETED' }, select: { id: true } }),
      prisma.user.count({ where: { orgId, role: 'TECH' } }),
      prisma.timeEntry.findMany({ where: { orgId, startedAt: { gte: startOfDay } }, distinct: ['userId'], select: { userId: true } }),
      prisma.timeEntry.findMany({ where: { orgId, startedAt: { gte: startOfWeek } }, select: { accumulatedSeconds: true, startedAt: true, stoppedAt: true, pausedAt: true, status: true } }),
      prisma.workOrder.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, workOrderNumber: true, status: true, createdAt: true, customer: { select: { name: true } } } }),
      prisma.quote.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, quoteNumber: true, status: true, createdAt: true, customer: { select: { name: true } } } }),
      prisma.aITaskPlan.groupBy({ by: ['status'], where: { orgId }, _count: { id: true } }),
      prisma.taskInstance.groupBy({ by: ['status'], where: { orgId }, _count: { id: true } }),
      prisma.workPackage.groupBy({ by: ['packageType'], where: { orgId }, _count: { id: true } }),
      prisma.invoice.findMany({ where: { orgId, status: 'PAID', createdAt: { gte: sixMonthsAgo } }, select: { total: true, createdAt: true } }),
      prisma.invoice.groupBy({ by: ['customerId'], where: { orgId, status: 'PAID' }, _sum: { total: true }, orderBy: { _sum: { total: 'desc' } }, take: 5 }),
    ]);

    // Dependent query: completed WO value (needs completedWOs result)
    const completedWOIds = completedWOs.map(wo => wo.id);
    const [sourceQuotes, customerNames] = await Promise.all([
      completedWOIds.length > 0
        ? prisma.quote.findMany({ where: { orgId, convertedToOrderId: { in: completedWOIds } }, select: { total: true } })
        : Promise.resolve([]),
      prisma.customer.findMany({ where: { id: { in: customerRevenue.map(c => c.customerId) } }, select: { id: true, name: true } }),
    ]);

    // Process results
    const woTotal = workOrders.reduce((sum, g) => sum + g._count.id, 0);
    const woOpen = workOrders.find(g => g.status === 'OPEN')?._count.id || 0;
    const woInProgress = workOrders.find(g => g.status === 'IN_PROGRESS')?._count.id || 0;
    const woCompleted = workOrders.find(g => g.status === 'COMPLETED')?._count.id || 0;

    const quotesTotal = quotes.reduce((sum, g) => sum + g._count.id, 0);
    const quotesDraft = quotes.find(g => g.status === 'DRAFT')?._count.id || 0;
    const quotesSent = quotes.find(g => g.status === 'SENT')?._count.id || 0;
    const quotesApproved = quotes.find(g => g.status === 'APPROVED')?._count.id || 0;
    const pendingValue = quotes.find(g => g.status === 'SENT')?._sum.total || 0;
    const approvedValue = quotes.find(g => g.status === 'APPROVED')?._sum.total || 0;

    const invoicesTotal = invoices.reduce((sum, g) => sum + g._count.id, 0);
    const invoicesDraft = invoices.find(g => g.status === 'DRAFT')?._count.id || 0;
    const invoicesSent = invoices.find(g => g.status === 'SENT')?._count.id || 0;
    const invoicesPaid = invoices.find(g => g.status === 'PAID')?._count.id || 0;
    const invoicesOverdue = invoices.find(g => g.status === 'OVERDUE')?._count.id || 0;
    const totalBilled = invoices.reduce((sum, g) => sum + Number(g._sum.total || 0), 0);
    const paidRevenue = invoices.find(g => g.status === 'PAID')?._sum.total || 0;
    const pendingRevenue = invoices.filter(g => g.status === 'SENT' || g.status === 'OVERDUE')
      .reduce((sum, g) => sum + Number(g._sum.total || 0), 0);

    const thisMonthInvoiced = Number(invoicesThisMonth._sum.total || 0);
    const completedWorkValue = sourceQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0);

    // Timer hours calculation
    const now = new Date();
    let totalSecondsThisWeek = 0;
    for (const timer of timersThisWeek) {
      let seconds = timer.accumulatedSeconds || 0;
      if (timer.status === 'RUNNING' && timer.startedAt) {
        const runningSince = timer.pausedAt || timer.startedAt;
        seconds += Math.floor((now.getTime() - runningSince.getTime()) / 1000);
      }
      totalSecondsThisWeek += seconds;
    }
    const totalHoursThisWeek = totalSecondsThisWeek / 3600;

    // Recent activity
    const recentActivity = [
      ...recentWOs.map(wo => ({
        id: wo.id, type: 'WORK_ORDER' as const,
        description: `Work Order ${wo.workOrderNumber} - ${wo.customer?.name || "Unknown"} (${wo.status})`,
        timestamp: wo.createdAt.toISOString(),
      })),
      ...recentQuotes.map(q => ({
        id: q.id, type: 'QUOTE' as const,
        description: `Quote ${q.quoteNumber} - ${q.customer?.name || "Unknown"} (${q.status})`,
        timestamp: q.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

    const aiGenerated = aiTaskPlans.find(g => g.status === 'GENERATED')?._count.id || 0;
    const aiApproved = aiTaskPlans.find(g => g.status === 'APPROVED')?._count.id || 0;
    const aiRejected = aiTaskPlans.find(g => g.status === 'REJECTED')?._count.id || 0;

    const totalTasks = allTasks.reduce((sum, g) => sum + g._count.id, 0);
    const tasksTodo = allTasks.find(g => g.status === 'TODO')?._count.id || 0;
    const tasksInProgress = allTasks.find(g => g.status === 'IN_PROGRESS')?._count.id || 0;
    const tasksDone = allTasks.find(g => g.status === 'DONE')?._count.id || 0;
    const tasksBlocked = allTasks.find(g => g.status === 'BLOCKED')?._count.id || 0;
    const completionRate = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;
    const totalPackages = packages.reduce((sum, g) => sum + g._count.id, 0);

    // Revenue chart data
    const monthlyRevenue: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      monthlyRevenue[date.toLocaleString('default', { month: 'short' })] = 0;
    }
    for (const inv of revenueByMonth) {
      const key = inv.createdAt.toLocaleString('default', { month: 'short' });
      if (key in monthlyRevenue) monthlyRevenue[key] += Number(inv.total || 0);
    }
    const revenueChartData = Object.entries(monthlyRevenue).map(([month, amount]) => ({ month, revenue: amount }));

    // Top customers
    const customerNameMap = new Map(customerNames.map(c => [c.id, c.name]));
    const topCustomers = customerRevenue.map(c => ({
      name: customerNameMap.get(c.customerId) || 'Unknown',
      revenue: Number(c._sum.total || 0),
    }));

    // Work orders by status for pie chart
    const woStatusData = [
      { name: 'Open', value: woOpen, color: '#3b82f6' },
      { name: 'In Progress', value: woInProgress, color: '#f59e0b' },
      { name: 'Completed', value: woCompleted, color: '#10b981' },
    ].filter(d => d.value > 0);

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
      charts: {
        revenueByMonth: revenueChartData,
        workOrdersByStatus: woStatusData,
        topCustomers,
      },
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
