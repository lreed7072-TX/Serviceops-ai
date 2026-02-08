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
                    name: true,
                    measurementType: true,
                    numericValue: true,
                    textValue: true,
                    passFail: true,
                    unit: true,
                    minValue: true,
                    maxValue: true,
                    isWithinSpec: true,
                    capturedAt: true,
                    capturedByUser: {
                      select: { id: true, name: true, email: true },
                    },
                  },
                  orderBy: {
                    createdAt: "asc",
                  },
                },
              },
              orderBy: {
                sequenceNumber: "asc",
              },
            },
          },
          orderBy: {
            packageType: "asc",
          },
        },
        visits: {
          include: {
            assignedTech: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
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

// PATCH /api/work-orders/[id] - Update work order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    // Check work order exists and belongs to org
    const existing = await prisma.workOrder.findUnique({
      where: { id, orgId: auth.orgId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return jsonError("Work order not found", 404);
    }

    // Don't allow editing completed or canceled work orders
    if (existing.status === "COMPLETED" || existing.status === "CANCELED") {
      return jsonError(`Cannot edit a ${existing.status.toLowerCase()} work order`, 400);
    }

    const body = await request.json();
    const {
      title,
      description,
      customerId,
      siteId,
      assetId,
      executionMode,
      orderType,
      status,
      scheduledStart,
      scheduledEnd,
      priority,
    } = body;

    // Build update data - only include fields that were provided
    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (customerId !== undefined) updateData.customerId = customerId;
    if (siteId !== undefined) updateData.siteId = siteId;
    if (assetId !== undefined) updateData.assetId = assetId || null;
    if (executionMode !== undefined) updateData.executionMode = executionMode;
    if (orderType !== undefined) updateData.orderType = orderType;
    if (status !== undefined) updateData.status = status;
    if (scheduledStart !== undefined) updateData.scheduledStart = scheduledStart ? new Date(scheduledStart) : null;
    if (scheduledEnd !== undefined) updateData.scheduledEnd = scheduledEnd ? new Date(scheduledEnd) : null;
    if (priority !== undefined) updateData.priority = priority;

    const workOrder = await prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, serialNumber: true, assetTag: true } },
      },
    });

    return jsonResponse({ data: workOrder, message: "Work order updated successfully" });
  } catch (error) {
    console.error("Failed to update work order:", error);
    return jsonError("Failed to update work order", 500);
  }
}

// DELETE /api/work-orders/[id] - Delete work order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // Only ADMIN can delete work orders
    if (auth.role !== "ADMIN") {
      return jsonError("Only administrators can delete work orders", 403);
    }

    const { id } = await params;

    // Check work order exists and belongs to org
    const existing = await prisma.workOrder.findUnique({
      where: { id, orgId: auth.orgId },
      select: { id: true, status: true, workOrderNumber: true },
    });

    if (!existing) {
      return jsonError("Work order not found", 404);
    }

    // Only allow deleting OPEN or CANCELED work orders
    if (existing.status !== "OPEN" && existing.status !== "CANCELED") {
      return jsonError(
        `Cannot delete a work order with status ${existing.status}. Only OPEN or CANCELED work orders can be deleted.`,
        400
      );
    }

    // Delete the work order (cascades will handle related records)
    await prisma.workOrder.delete({
      where: { id },
    });

    return jsonResponse({ success: true, message: `Work order ${existing.workOrderNumber} deleted successfully` });
  } catch (error) {
    console.error("Failed to delete work order:", error);
    return jsonError("Failed to delete work order", 500);
  }
}
