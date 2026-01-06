import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, WorkPackageType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

type ApplyPayload = {
  workOrderId: string;
  assignedToId?: string | null; // Optional: assign all tasks to this tech
};

/**
 * POST /api/standards-packs/:id/apply
 * Apply a standards pack to a work order - creates work packages and tasks
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: packId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<ApplyPayload>(request);
  if (!body?.workOrderId) {
    return jsonError("workOrderId is required.", 400);
  }

  // Verify pack exists and is ACTIVE
  const pack = await prisma.standardsPack.findFirst({
    where: { id: packId, orgId: authResult.auth.orgId },
    include: {
      tasks: {
        orderBy: [{ packageType: "asc" }, { sequenceNumber: "asc" }],
      },
    },
  });

  if (!pack) {
    return jsonError("Standards pack not found.", 404);
  }

  if (pack.status !== "ACTIVE") {
    return jsonError("Only ACTIVE packs can be applied to work orders.", 400);
  }

  if (pack.tasks.length === 0) {
    return jsonError("This pack has no tasks to apply.", 400);
  }

  // Verify work order exists
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: body.workOrderId, orgId: authResult.auth.orgId },
    select: { id: true, executionMode: true },
  });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  // Group tasks by package type
  const tasksByType: Record<WorkPackageType, typeof pack.tasks> = {
    MECH_ELEC_UNIFIED: [],
    MECHANICAL: [],
    ELECTRICAL: [],
    CONTROLS: [],
    INSTRUMENTATION: [],
  };

  for (const task of pack.tasks) {
    tasksByType[task.packageType].push(task);
  }

  // Determine which package types to create based on execution mode
  let packageTypesToCreate: WorkPackageType[] = [];
  
  if (workOrder.executionMode === "UNIFIED") {
    // Unified mode: all tasks go into a single MECH_ELEC_UNIFIED package
    packageTypesToCreate = ["MECH_ELEC_UNIFIED"];
  } else {
    // Multi-lane mode: create separate packages for each type that has tasks
    packageTypesToCreate = (Object.keys(tasksByType) as WorkPackageType[]).filter(
      (type) => tasksByType[type].length > 0
    );
  }

  // Create work packages and tasks
  const createdPackages: any[] = [];
  const createdTasks: any[] = [];

  for (const pkgType of packageTypesToCreate) {
    // Get tasks for this package type
    let tasksForPackage = tasksByType[pkgType];

    // In UNIFIED mode, combine all tasks
    if (workOrder.executionMode === "UNIFIED" && pkgType === "MECH_ELEC_UNIFIED") {
      tasksForPackage = pack.tasks;
    }

    if (tasksForPackage.length === 0) continue;

    // Get friendly name for package
    const packageNames: Record<WorkPackageType, string> = {
      MECH_ELEC_UNIFIED: pack.name,
      MECHANICAL: `${pack.name} - Mechanical`,
      ELECTRICAL: `${pack.name} - Electrical`,
      CONTROLS: `${pack.name} - Controls`,
      INSTRUMENTATION: `${pack.name} - Instrumentation`,
    };

    // Create work package
    const workPackage = await prisma.workPackage.create({
      data: {
        orgId: authResult.auth.orgId,
        workOrderId: body.workOrderId,
        packageType: pkgType,
        name: packageNames[pkgType],
        status: "PLANNED",
      },
    });

    createdPackages.push(workPackage);

    // Create task instances from template tasks
    for (const templateTask of tasksForPackage) {
      const taskInstance = await prisma.taskInstance.create({
        data: {
          orgId: authResult.auth.orgId,
          workOrderId: body.workOrderId,
          workPackageId: workPackage.id,
          title: templateTask.title,
          description: templateTask.description,
          status: "TODO",
          sequenceNumber: templateTask.sequenceNumber,
          assignedToId: body.assignedToId ?? null,
          isCritical: templateTask.isCritical,
          requiresEvidence: templateTask.requiresEvidence,
        },
      });

      createdTasks.push(taskInstance);
    }
  }

  return NextResponse.json({
    data: {
      packId: pack.id,
      packName: pack.name,
      workOrderId: body.workOrderId,
      packagesCreated: createdPackages.length,
      tasksCreated: createdTasks.length,
      packages: createdPackages,
    },
  });
}
