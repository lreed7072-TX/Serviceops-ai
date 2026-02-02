import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { Role, TaskStatus, PackageType } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // 1) Work order access gate (TECH must be assigned via task/visit/lead package)
  const whereWO: any = { id, orgId: auth.orgId };
  if (auth.role === Role.TECH) {
    whereWO.OR = [
      { tasks: { some: { assignedToId: auth.userId } } },
      { visits: { some: { assignedTechId: auth.userId } } },
      { packages: { some: { leadTechId: auth.userId } } },
    ];
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: whereWO,
    select: { id: true },
  });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  // 2) Task list filter (TECH sees assigned tasks + tasks in packages they lead)
  const whereTasks: any = { orgId: auth.orgId, workOrderId: workOrder.id };
  if (auth.role === Role.TECH) {
    whereTasks.OR = [
      { assignedToId: auth.userId },
      { workPackage: { leadTechId: auth.userId } },
    ];
  }

  const tasks = await prisma.taskInstance.findMany({
    where: whereTasks,
    orderBy: [{ sequenceNumber: "asc" }, { createdAt: "asc" }],
    include: { 
      workPackage: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      blockedBy: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json({ data: tasks });
}

// POST /api/work-orders/[id]/tasks - Create a new task
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Only ADMIN and DISPATCHER can create tasks
  if (auth.role !== Role.ADMIN && auth.role !== Role.DISPATCHER) {
    return jsonError("Insufficient permissions to create tasks", 403);
  }

  // Verify work order exists and is editable
  const workOrder = await prisma.workOrder.findUnique({
    where: { id, orgId: auth.orgId },
    select: { id: true, status: true, orgId: true },
  });

  if (!workOrder) {
    return jsonError("Work order not found", 404);
  }

  if (workOrder.status === "COMPLETED" || workOrder.status === "CANCELED") {
    return jsonError(`Cannot add tasks to a ${workOrder.status.toLowerCase()} work order`, 400);
  }

  const body = await request.json();
  const {
    title,
    description,
    isCritical = false,
    requiresEvidence = false,
    estimatedMinutes,
    assignedToId,
    workPackageId,
  } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return jsonError("Task title is required", 400);
  }

  // Get or create a default work package for the task
  let packageId = workPackageId;

  if (!packageId) {
    // Find or create a default "General Tasks" package
    let defaultPackage = await prisma.workPackage.findFirst({
      where: {
        workOrderId: workOrder.id,
        packageType: PackageType.GENERAL,
      },
    });

    if (!defaultPackage) {
      defaultPackage = await prisma.workPackage.create({
        data: {
          orgId: auth.orgId,
          workOrderId: workOrder.id,
          packageType: PackageType.GENERAL,
          name: "General Tasks",
        },
      });
    }

    packageId = defaultPackage.id;
  }

  // Get the next sequence number
  const lastTask = await prisma.taskInstance.findFirst({
    where: { workOrderId: workOrder.id },
    orderBy: { sequenceNumber: "desc" },
    select: { sequenceNumber: true },
  });

  const nextSequence = (lastTask?.sequenceNumber ?? 0) + 1;

  // Create the task
  const task = await prisma.taskInstance.create({
    data: {
      orgId: auth.orgId,
      workOrderId: workOrder.id,
      workPackageId: packageId,
      title: title.trim(),
      description: description?.trim() || null,
      status: TaskStatus.TODO,
      sequenceNumber: nextSequence,
      isCritical,
      requiresEvidence,
      estimatedMinutes: estimatedMinutes || null,
      assignedToId: assignedToId || null,
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      workPackage: { select: { id: true, name: true, packageType: true } },
    },
  });

  return NextResponse.json({ data: task, message: "Task created successfully" }, { status: 201 });
}
