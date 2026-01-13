import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, AITaskPlanStatus, WorkPackageType } from "@prisma/client";

// POST /api/ai-task-plans/[id]/approve - Approve AI task plan and create real tasks
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: aiTaskPlanId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId, userId } = auth;

  // Only admins and dispatchers can approve
  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  try {
    // Parse request body for assignment info
    const body = await req.json();
    const { assignedToId } = body;

    // Fetch the AI task plan
    const aiTaskPlan = await prisma.aITaskPlan.findFirst({
      where: { id: aiTaskPlanId, orgId },
      include: {
        workOrder: {
          include: {
            packages: true,
          },
        },
      },
    });

    if (!aiTaskPlan) {
      return NextResponse.json({ error: "AI task plan not found" }, { status: 404 });
    }

    if (aiTaskPlan.status !== AITaskPlanStatus.GENERATED) {
      return NextResponse.json(
        { error: `Cannot approve task plan with status: ${aiTaskPlan.status}` },
        { status: 400 }
      );
    }

    // Parse the AI-generated tasks
    const parsedTasks = aiTaskPlan.parsedTasksSnapshotJson as any[];
    if (!parsedTasks || parsedTasks.length === 0) {
      return NextResponse.json(
        { error: "No tasks found in AI plan" },
        { status: 400 }
      );
    }

    // Group tasks by domain for multi-lane routing
    const tasksByDomain: Record<string, typeof parsedTasks> = {
      MECHANICAL: [],
      ELECTRICAL: [],
      CONTROLS: [],
      INSTRUMENTATION: [],
      UNIFIED: [],
    };

    for (const task of parsedTasks) {
      const domain = task.domain || "UNIFIED";
      if (domain in tasksByDomain) {
        tasksByDomain[domain].push(task);
      } else {
        tasksByDomain.UNIFIED.push(task);
      }
    }

    // Create packages as needed and assign tasks
    const createdTasks = [];
    const packageNames: Record<string, string> = {
      MECHANICAL: "Mechanical Tasks",
      ELECTRICAL: "Electrical Tasks",
      CONTROLS: "Controls Tasks",
      INSTRUMENTATION: "Instrumentation Tasks",
      UNIFIED: "Multi-Domain Tasks",
    };

    const packageTypeMap: Record<string, WorkPackageType> = {
      MECHANICAL: WorkPackageType.MECHANICAL,
      ELECTRICAL: WorkPackageType.ELECTRICAL,
      CONTROLS: WorkPackageType.CONTROLS,
      INSTRUMENTATION: WorkPackageType.INSTRUMENTATION,
      UNIFIED: WorkPackageType.MECH_ELEC_UNIFIED,
    };

    for (const [domain, domainTasks] of Object.entries(tasksByDomain)) {
      if (domainTasks.length === 0) continue;

      const packageType = packageTypeMap[domain] || WorkPackageType.MECH_ELEC_UNIFIED;

      // Find or create package for this domain
      let domainPackage = await prisma.workPackage.findFirst({
        where: {
          workOrderId: aiTaskPlan.workOrderId,
          orgId,
          packageType,
        },
      });

      if (!domainPackage) {
        domainPackage = await prisma.workPackage.create({
          data: {
            orgId,
            workOrderId: aiTaskPlan.workOrderId,
            packageType,
            name: packageNames[domain] || "AI Generated Tasks",
            status: "PLANNED",
          },
        });
      }

      // Create tasks in this package
      for (const aiTask of domainTasks) {
        const task = await prisma.taskInstance.create({
          data: {
            orgId,
            workOrderId: aiTaskPlan.workOrderId,
            workPackageId: domainPackage.id,
            title: aiTask.title,
            description: aiTask.description || null,
            sequenceNumber: aiTask.sequenceNumber || 0,
            status: "TODO",
            isCritical: aiTask.isCritical || false,
            assignedToId: assignedToId || null,
          },
        });

        // Create measurements if defined
        if (aiTask.measurements && Array.isArray(aiTask.measurements)) {
          for (const measurement of aiTask.measurements) {
            await prisma.measurementDefinition.create({
              data: {
                orgId,
                taskInstanceId: task.id,
                standardsPackTaskId: null,
                name: measurement.name,
                unit: measurement.unit || null,
                measurementType: measurement.measurementType || "NUMERIC",
                minValue: measurement.minValue || null,
                maxValue: measurement.maxValue || null,
                isRequired: true,
              },
            });
          }
        }

        createdTasks.push(task);
      }
    }

    // Update AI task plan status to APPROVED
    const updatedPlan = await prisma.aITaskPlan.update({
      where: { id: aiTaskPlanId },
      data: {
        status: AITaskPlanStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: userId,
      },
    });

    return NextResponse.json({
      data: {
        aiTaskPlan: updatedPlan,
        createdTasks,
        packagesCreated: Object.keys(tasksByDomain).filter(d => tasksByDomain[d].length > 0).length,
      },
    });
  } catch (error: any) {
    console.error("AI task plan approval error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to approve AI task plan" },
      { status: 500 }
    );
  }
}

// POST /api/ai-task-plans/[id]/reject - Reject AI task plan
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: aiTaskPlanId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  // Only admins and dispatchers can reject
  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  try {
    const body = await req.json();
    const { reason } = body;

    const aiTaskPlan = await prisma.aITaskPlan.findFirst({
      where: { id: aiTaskPlanId, orgId },
    });

    if (!aiTaskPlan) {
      return NextResponse.json({ error: "AI task plan not found" }, { status: 404 });
    }

    // Update status to REJECTED
    const updatedPlan = await prisma.aITaskPlan.update({
      where: { id: aiTaskPlanId },
      data: {
        status: AITaskPlanStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason || "Rejected by user",
      },
    });

    return NextResponse.json({ data: updatedPlan });
  } catch (error: any) {
    console.error("AI task plan rejection error:", error);
    return NextResponse.json(
      { error: "Failed to reject AI task plan" },
      { status: 500 }
    );
  }
}
