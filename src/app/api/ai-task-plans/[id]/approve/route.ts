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

    // Determine target work package (create if needed)
    let targetPackage = aiTaskPlan.workOrder.packages.find(
      (pkg) => pkg.packageType === WorkPackageType.MECH_ELEC_UNIFIED
    );

    if (!targetPackage) {
      // Create a unified package for AI-generated tasks
      targetPackage = await prisma.workPackage.create({
        data: {
          orgId,
          workOrderId: aiTaskPlan.workOrderId,
          packageType: WorkPackageType.MECH_ELEC_UNIFIED,
          name: "AI Generated Tasks",
          status: "PLANNED",
        },
      });
    }

    // Create TaskInstance records from AI tasks
    const createdTasks = [];
    for (const aiTask of parsedTasks) {
      const task = await prisma.taskInstance.create({
        data: {
          orgId,
          workOrderId: aiTaskPlan.workOrderId,
          workPackageId: targetPackage.id,
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
        workPackage: targetPackage,
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
