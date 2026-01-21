import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// GET /api/work-orders/[id] - Get work order with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    const workOrder = await prisma.workOrder.findUnique({
      where: { id, orgId: auth.orgId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
            primaryEmail: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        packages: {
          include: {
            tasks: {
              include: {
                assignedTo: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                timeEntries: {
                  select: {
                    id: true,
                    status: true,
                    accumulatedSeconds: true,
                    startedAt: true,
                    stoppedAt: true,
                  },
                },
                materialUsages: {
                  include: {
                    material: {
                      select: {
                        id: true,
                        name: true,
                        partNumber: true,
                        category: true,
                      },
                    },
                  },
                  orderBy: {
                    addedAt: "desc",
                  },
                },
                measurements: {
                  select: {
                    id: true,
                    measurementType: true,
                    value: true,
                    unit: true,
                    label: true,
                    notes: true,
                    createdAt: true,
                  },
                  orderBy: {
                    createdAt: "desc",
                  },
                },
              },
              orderBy: {
                sequenceNumber: "asc",
              },
            },
          },
          orderBy: {
            type: "asc",
          },
        },
        timeEntries: {
          select: {
            id: true,
            accumulatedSeconds: true,
            status: true,
          },
        },
      },
    });

    if (!workOrder) {
      return jsonError("Work order not found", 404);
    }

    // Calculate summary metrics
    const totalTasks = workOrder.packages.reduce((sum, pkg) => sum + pkg.tasks.length, 0);
    const completedTasks = workOrder.packages.reduce(
      (sum, pkg) => sum + pkg.tasks.filter((t) => t.status === "DONE").length,
      0
    );

    const totalLaborSeconds = workOrder.timeEntries.reduce(
      (sum, entry) => sum + (entry.accumulatedSeconds || 0),
      0
    );
    const totalLaborHours = totalLaborSeconds / 3600;

    const totalMaterialCost = workOrder.packages.reduce(
      (sum, pkg) =>
        sum + pkg.tasks.reduce((taskSum, task) => 
          taskSum + task.materialUsages.reduce((matSum, mat) => matSum + (mat.totalCost || 0), 0)
        , 0)
      , 0
    );

    return jsonResponse({
      data: {
        ...workOrder,
        summary: {
          totalTasks,
          completedTasks,
          completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
          totalLaborHours: Math.round(totalLaborHours * 10) / 10,
          totalMaterialCost,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch work order:", error);
    return jsonError("Failed to fetch work order", 500);
  }
}
