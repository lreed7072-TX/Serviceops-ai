import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/generate-pms
 * Vercel Cron job - auto-generates work orders for due PM schedules.
 * Runs daily at 6 AM UTC.
 * Secured via CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const errors: string[] = [];
  let generated = 0;

  try {
    // Find all active schedules that are due and have auto-generate enabled
    const dueSchedules = await prisma.workflowDefinition.findMany({
      where: {
        status: "ACTIVE",
        autoGenerateWorkOrders: true,
        nextScheduledDate: { lte: now },
      },
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

    for (const schedule of dueSchedules) {
      try {
        // Skip if missing required fields
        if (!schedule.customerId || !schedule.siteId) {
          errors.push(`${schedule.name}: missing customer or site`);
          continue;
        }

        // Generate work order number
        const lastWO = await prisma.workOrder.findFirst({
          where: { orgId: schedule.orgId },
          orderBy: { createdAt: "desc" },
          select: { workOrderNumber: true },
        });

        const lastNum = lastWO?.workOrderNumber
          ? parseInt(lastWO.workOrderNumber.replace(/\D/g, "")) || 0
          : 0;
        const workOrderNumber = `WO-${String(lastNum + 1).padStart(5, "0")}`;

        // Calculate due date (7 days from scheduled date)
        const baseDate = schedule.nextScheduledDate ?? now;
        const dueDate = new Date(baseDate);
        dueDate.setDate(dueDate.getDate() + 7);

        // Create work order
        const workOrder = await prisma.workOrder.create({
          data: {
            orgId: schedule.orgId,
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
            createdByUserId: schedule.createdByUserId,
            sourceWorkflowId: schedule.id,
          },
        });

        // Create work package
        const workPackage = await prisma.workPackage.create({
          data: {
            orgId: schedule.orgId,
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
            orgId: schedule.orgId,
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
              orgId: schedule.orgId,
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

        // Advance next scheduled date
        const nextDate = calculateNextDate(
          new Date(baseDate),
          schedule.frequencyType ?? "MONTHLY",
          schedule.frequencyValue ?? 1
        );

        await prisma.workflowDefinition.update({
          where: { id: schedule.id },
          data: {
            lastGeneratedWorkOrderId: workOrder.id,
            lastGeneratedDate: now,
            nextScheduledDate: nextDate,
            executionCount: { increment: 1 },
          },
        });

        generated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${schedule.name}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      checked: dueSchedules.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("PM cron error:", error);
    return NextResponse.json(
      { error: "Failed to process PM schedules" },
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
