import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/pm-schedules/[id]/generate-work-order
 * Manually generate a work order from a PM schedule
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN", "DISPATCHER"]);
    if (roleCheck) return roleCheck;

    const { id: scheduleId } = await params;

    const schedule = await prisma.workflowDefinition.findFirst({
      where: { id: scheduleId, orgId: auth.orgId },
      include: {
        asset: { select: { id: true, name: true } },
        procedureTemplate: {
          include: {
            steps: {
              orderBy: { sequenceNumber: "asc" },
            },
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "PM schedule not found" }, { status: 404 });
    }

    if (schedule.status !== "ACTIVE") {
      return NextResponse.json({ error: "PM schedule is not active" }, { status: 400 });
    }

    if (!schedule.customerId || !schedule.siteId) {
      return NextResponse.json(
        { error: "PM schedule missing customer or site" },
        { status: 400 }
      );
    }

    // Generate work order number
    const lastWO = await prisma.workOrder.findFirst({
      where: { orgId: auth.orgId },
      orderBy: { createdAt: "desc" },
      select: { workOrderNumber: true },
    });

    const lastNum = lastWO?.workOrderNumber
      ? parseInt(lastWO.workOrderNumber.replace(/\D/g, "")) || 0
      : 0;
    const workOrderNumber = `WO-${String(lastNum + 1).padStart(5, "0")}`;

    // Calculate due date
    const baseDate = schedule.nextScheduledDate ?? new Date();
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + 7);

    // Create work order
    const workOrder = await prisma.workOrder.create({
      data: {
        orgId: auth.orgId,
        workOrderNumber,
        title: schedule.workOrderTitle || `PM: ${schedule.name}`,
        description:
          schedule.description ||
          `Preventive maintenance for ${schedule.asset?.name ?? "equipment"}`,
        status: "OPEN",
        orderType: "WORK_ORDER",
        priority: schedule.priority || "MEDIUM",
        customerId: schedule.customerId,
        siteId: schedule.siteId,
        assetId: schedule.assetId,
        dueDate,
        estimatedHours: schedule.estimatedHours,
        createdByUserId: auth.userId,
        sourceWorkflowId: scheduleId,
      },
    });

    // Create work package
    const workPackage = await prisma.workPackage.create({
      data: {
        orgId: auth.orgId,
        workOrderId: workOrder.id,
        name: "PM Tasks",
        packageType: "MECH_ELEC_UNIFIED",
        status: "PLANNED",
      },
    });

    // Create tasks from procedure template steps, or a generic task
    if (
      schedule.procedureTemplate?.steps &&
      schedule.procedureTemplate.steps.length > 0
    ) {
      const tasks = schedule.procedureTemplate.steps.map((step) => ({
        orgId: auth.orgId,
        workOrderId: workOrder.id,
        workPackageId: workPackage.id,
        title: step.title,
        description: step.description || null,
        status: "TODO" as const,
        sequenceNumber: step.sequenceNumber,
        isCritical: step.isCritical,
        requiresEvidence: step.requiresEvidence,
      }));

      await prisma.taskInstance.createMany({ data: tasks });
    } else {
      await prisma.taskInstance.create({
        data: {
          orgId: auth.orgId,
          workOrderId: workOrder.id,
          workPackageId: workPackage.id,
          title: "Complete PM Inspection",
          description: `Perform preventive maintenance on ${schedule.asset?.name ?? "equipment"}`,
          status: "TODO",
          sequenceNumber: 1,
          requiresEvidence: true,
        },
      });
    }

    // Update schedule - advance next date and record generation
    const nextDate = calculateNextDate(
      new Date(baseDate),
      schedule.frequencyType ?? "MONTHLY",
      schedule.frequencyValue ?? 1
    );

    await prisma.workflowDefinition.update({
      where: { id: scheduleId },
      data: {
        lastGeneratedWorkOrderId: workOrder.id,
        lastGeneratedDate: new Date(),
        nextScheduledDate: nextDate,
        executionCount: { increment: 1 },
      },
    });

    return NextResponse.json(
      {
        data: workOrder,
        message: `Work order ${workOrderNumber} created successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Generate work order error:", error);
    return NextResponse.json(
      { error: "Failed to generate work order" },
      { status: 500 }
    );
  }
}

function calculateNextDate(
  fromDate: Date,
  frequencyType: string,
  frequencyValue: number
): Date {
  const next = new Date(fromDate);
  switch (frequencyType) {
    case "DAILY":
      next.setDate(next.getDate() + frequencyValue);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + frequencyValue * 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + frequencyValue);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + frequencyValue);
      break;
  }
  return next;
}
