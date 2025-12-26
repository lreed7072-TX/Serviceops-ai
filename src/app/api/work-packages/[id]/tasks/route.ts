import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";
import { TaskStatus } from "@prisma/client";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type TaskPayload = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  sequenceNumber?: number | null;
  assignedToId?: string | null;
  isCritical?: boolean;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const workPackage = await prisma.workPackage.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!workPackage) {
    return jsonError("Work package not found.", 404);
  }

  const body = await parseJson<TaskPayload>(request);
  if (!body?.title) {
    return jsonError("Task title is required.");
  }

  let assignedToId: string | null = null;
  if (body.assignedToId) {
    const user = await prisma.user.findFirst({
      where: { id: body.assignedToId, orgId: authResult.auth.orgId },
    });
    if (!user) {
      return jsonError("Assigned technician not found.", 404);
    }
    assignedToId = user.id;
  }

  const status =
    body.status && Object.values(TaskStatus).includes(body.status)
      ? body.status
      : TaskStatus.TODO;

  const task = await prisma.taskInstance.create({
    data: {
      orgId: authResult.auth.orgId,
      workOrderId: workPackage.workOrderId,
      workPackageId: workPackage.id,
      title: body.title,
      description: body.description ?? null,
      status,
      sequenceNumber: body.sequenceNumber ?? null,
      assignedToId,
      isCritical: body.isCritical ?? false,
    },
  });

  return NextResponse.json({ data: task }, { status: 201 });
}
