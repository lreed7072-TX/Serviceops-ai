import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TaskStatus } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/work-orders/:id/report
 * Generate comprehensive report data for a work order
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Fetch complete work order with all related data
  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id: workOrderId,
      orgId: authResult.auth.orgId,
    },
    include: {
      customer: true,
      site: true,
      asset: true,
      packages: {
        include: {
          tasks: {
            include: {
              assignedTo: {
                select: { id: true, name: true, email: true },
              },
              evidence: {
                orderBy: { createdAt: "asc" },
              },
              measurements: {
                include: {
                  measurementDefinition: true,
                },
                orderBy: { recordedAt: "asc" },
              },
              materialUsages: {
                include: {
                  material: true,
                },
                orderBy: { createdAt: "asc" },
              },
              timeEntries: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true },
                  },
                },
                orderBy: { startTime: "asc" },
              },
            },
            orderBy: { sequenceNumber: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      signatures: {
        orderBy: { signedAt: "asc" },
      },
    },
  });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  // Calculate summary statistics
  const allTasks = workOrder.packages.flatMap(pkg => pkg.tasks);
  const completedTasks = allTasks.filter(t => t.status === TaskStatus.DONE);
  const totalMaterialsCost = allTasks
    .flatMap(t => t.materialUsages)
    .reduce((sum, m) => sum + (m.totalCost || 0), 0);
  const totalLaborHours = allTasks
    .flatMap(t => t.timeEntries)
    .reduce((sum, e) => sum + (e.durationMinutes || 0), 0) / 60;

  // Compile report data
  const reportData = {
    workOrder: {
      id: workOrder.id,
      title: workOrder.title,
      description: workOrder.description,
      orderType: workOrder.orderType,
      priority: workOrder.priority,
      status: workOrder.status,
      createdAt: workOrder.createdAt,
      scheduledStartDate: workOrder.scheduledStartDate,
      actualStartDate: workOrder.actualStartDate,
      completedAt: workOrder.completedAt,
    },
    customer: workOrder.customer,
    site: workOrder.site,
    asset: workOrder.asset,
    summary: {
      totalPackages: workOrder.packages.length,
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      completionRate: allTasks.length > 0 
        ? Math.round((completedTasks.length / allTasks.length) * 100) 
        : 0,
      totalMaterialsCost,
      totalLaborHours,
      criticalTasksCompleted: completedTasks.filter(t => t.isCritical).length,
      totalCriticalTasks: allTasks.filter(t => t.isCritical).length,
    },
    packages: workOrder.packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      type: pkg.packageType,
      status: pkg.status,
      tasks: pkg.tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        isCritical: task.isCritical,
        assignedTo: task.assignedTo,
        evidence: task.evidence.map(e => ({
          type: e.type,
          noteText: e.noteText,
          url: e.url,
          createdAt: e.createdAt,
        })),
        measurements: task.measurements.map(m => ({
          name: m.definition?.name || "Unknown",
          value: m.numericValue || m.textValue || (m.passFailValue ? "PASS" : "FAIL"),
          unit: m.definition?.unit,
          recordedAt: m.recordedAt,
        })),
        materials: task.materialUsages.map(m => ({
          name: m.name,
          partNumber: m.partNumber,
          quantity: m.quantity,
          unit: m.unit,
          totalCost: m.totalCost,
        })),
        timeEntries: task.timeEntries.map(t => ({
          user: t.user,
          startTime: t.startTime,
          endTime: t.endTime,
          durationMinutes: t.durationMinutes,
        })),
      })),
    })),
    signatures: workOrder.signatures,
  };

  return NextResponse.json({ data: reportData });
}
