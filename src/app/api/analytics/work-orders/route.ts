import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/analytics/work-orders - Work order performance metrics
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Default to last 30 days
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Get work orders for period
    const workOrders = await prisma.workOrder.findMany({
      where: {
        orgId: auth.orgId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        woNumber: true,
        status: true,
        orderType: true,
        createdAt: true,
        completedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        tasks: {
          select: {
            id: true,
            status: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        timeEntries: {
          select: {
            accumulatedSeconds: true,
          },
        },
      },
    });

    // Status distribution
    const statusCounts = workOrders.reduce((acc: any, wo) => {
      acc[wo.status] = (acc[wo.status] || 0) + 1;
      return acc;
    }, {});

    // Type distribution
    const typeCounts = workOrders.reduce((acc: any, wo) => {
      acc[wo.orderType] = (acc[wo.orderType] || 0) + 1;
      return acc;
    }, {});

    // Completion metrics
    const completedOrders = workOrders.filter((wo) => wo.completedAt);
    const completionRate = workOrders.length > 0 ? (completedOrders.length / workOrders.length) * 100 : 0;

    // Average completion time (in days)
    const completionTimes = completedOrders
      .map((wo) => {
        if (!wo.completedAt) return 0;
        return (new Date(wo.completedAt).getTime() - new Date(wo.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      })
      .filter((time) => time > 0);

    const avgCompletionTime =
      completionTimes.length > 0
        ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
        : 0;

    // Customer frequency
    const customerWorkOrders = workOrders.reduce((acc: any[], wo) => {
      const existing = acc.find((item) => item.customerId === wo.customer.id);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({
          customerId: wo.customer.id,
          customerName: wo.customer.name,
          count: 1,
        });
      }
      return acc;
    }, []);

    customerWorkOrders.sort((a, b) => b.count - a.count);

    // Technician workload
    const technicianWorkload = workOrders.reduce((acc: any[], wo) => {
      wo.tasks.forEach((task) => {
        if (task.assignedTo) {
          const existing = acc.find((item) => item.userId === task.assignedTo.id);
          if (existing) {
            existing.taskCount += 1;
            if (task.status === "COMPLETED") existing.completedTasks += 1;
          } else {
            acc.push({
              userId: task.assignedTo.id,
              userName: task.assignedTo.name,
              taskCount: 1,
              completedTasks: task.status === "COMPLETED" ? 1 : 0,
            });
          }
        }
      });
      return acc;
    }, []);

    // Calculate completion rate for each technician
    technicianWorkload.forEach((tech) => {
      tech.completionRate = tech.taskCount > 0 ? (tech.completedTasks / tech.taskCount) * 100 : 0;
    });

    technicianWorkload.sort((a, b) => b.taskCount - a.taskCount);

    // Total labor hours
    const totalLaborSeconds = workOrders.reduce((sum, wo) => {
      return sum + wo.timeEntries.reduce((entrySum, entry) => entrySum + (entry.accumulatedSeconds || 0), 0);
    }, 0);

    const totalLaborHours = Math.round(totalLaborSeconds / 3600); // Convert seconds to hours

    // Monthly trend
    const monthlyTrend = workOrders.reduce((acc: any[], wo) => {
      const month = new Date(wo.createdAt).toISOString().slice(0, 7);
      const existing = acc.find((item) => item.month === month);
      
      if (existing) {
        existing.count += 1;
        if (wo.completedAt) existing.completed += 1;
      } else {
        acc.push({
          month,
          count: 1,
          completed: wo.completedAt ? 1 : 0,
        });
      }
      return acc;
    }, []);

    monthlyTrend.sort((a, b) => a.month.localeCompare(b.month));

    return jsonResponse({
      data: {
        summary: {
          totalWorkOrders: workOrders.length,
          completedWorkOrders: completedOrders.length,
          completionRate,
          avgCompletionDays: Math.round(avgCompletionTime * 10) / 10,
          totalLaborHours,
        },
        statusDistribution: statusCounts,
        typeDistribution: typeCounts,
        topCustomers: customerWorkOrders.slice(0, 10),
        technicianPerformance: technicianWorkload,
        monthlyTrend,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/analytics/work-orders error:", error);
    return jsonError("Failed to fetch work order analytics", 500);
  }
}
