import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/pm-schedules/[id]
 * Get PM schedule details with history
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    const schedule = await prisma.workflowDefinition.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        asset: {
          select: { id: true, name: true, serialNumber: true },
        },
        site: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true },
        },
        procedureTemplate: {
          select: { id: true, name: true, description: true },
        },
        generatedWorkOrders: {
          select: {
            id: true,
            workOrderNumber: true,
            title: true,
            status: true,
            dueDate: true,
            completedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        lastGeneratedWorkOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            dueDate: true,
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "PM schedule not found" }, { status: 404 });
    }

    const completed = schedule.generatedWorkOrders.filter(
      (wo) => wo.status === "COMPLETED"
    ).length;
    const total = schedule.generatedWorkOrders.length;
    const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({
      data: { ...schedule, complianceRate },
    });
  } catch (error) {
    console.error("Get PM schedule error:", error);
    return NextResponse.json({ error: "Failed to load PM schedule" }, { status: 500 });
  }
}

/**
 * PATCH /api/pm-schedules/[id]
 * Update PM schedule
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN", "DISPATCHER"]);
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.workflowDefinition.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "PM schedule not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status) updateData.status = body.status;
    if (body.frequencyType) updateData.frequencyType = body.frequencyType;
    if (body.frequencyValue) updateData.frequencyValue = parseInt(body.frequencyValue);
    if (body.nextScheduledDate)
      updateData.nextScheduledDate = new Date(body.nextScheduledDate);
    if (body.autoGenerateWorkOrders !== undefined)
      updateData.autoGenerateWorkOrders = body.autoGenerateWorkOrders;
    if (body.workOrderTitle) updateData.workOrderTitle = body.workOrderTitle;
    if (body.estimatedHours !== undefined)
      updateData.estimatedHours = body.estimatedHours
        ? parseFloat(body.estimatedHours)
        : null;
    if (body.priority) updateData.priority = body.priority;

    const updated = await prisma.workflowDefinition.update({
      where: { id },
      data: updateData,
      include: {
        asset: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Update PM schedule error:", error);
    return NextResponse.json({ error: "Failed to update PM schedule" }, { status: 500 });
  }
}

/**
 * DELETE /api/pm-schedules/[id]
 * Archive PM schedule (soft delete)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN"]);
    if (roleCheck) return roleCheck;

    const { id } = await params;

    const existing = await prisma.workflowDefinition.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "PM schedule not found" }, { status: 404 });
    }

    await prisma.workflowDefinition.update({
      where: { id },
      data: { status: "ARCHIVED", autoGenerateWorkOrders: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete PM schedule error:", error);
    return NextResponse.json({ error: "Failed to delete PM schedule" }, { status: 500 });
  }
}
