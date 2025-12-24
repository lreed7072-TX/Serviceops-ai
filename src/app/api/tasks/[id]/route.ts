import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";
import { TaskStatus } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type TaskUpdatePayload = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assignedToId?: string | null;
  isCritical?: boolean;
  requiresEvidence?: boolean;
  sequenceNumber?: number | null;
};

const taskUpdateSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    assignedToId: z.string().nullable().optional(),
    isCritical: z.boolean().optional(),
    requiresEvidence: z.boolean().optional(),
    sequenceNumber: z.number().nullable().optional(),
  })
  .strip();

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const existing = await prisma.taskInstance.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Task not found.", 404);
  }

  const body = await parseJson<unknown>(request);
  const parsedBody = taskUpdateSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return jsonError(parsedBody.error.issues[0]?.message ?? "Invalid task payload.", 400);
  }

  const data: TaskUpdatePayload = {};
  const payload = parsedBody.data;

  if (payload.title !== undefined) {
    data.title = payload.title;
  }
  if (payload.description !== undefined) {
    data.description = payload.description;
  }
  if (payload.status !== undefined) {
    data.status = payload.status;
  }
  if (payload.sequenceNumber !== undefined) {
    data.sequenceNumber = payload.sequenceNumber;
  }
  if (payload.isCritical !== undefined) {
    data.isCritical = payload.isCritical;
  }
  if (payload.requiresEvidence !== undefined) {
    data.requiresEvidence = payload.requiresEvidence;
  }
  if (payload.assignedToId !== undefined) {
    if (!payload.assignedToId) {
      data.assignedToId = null;
    } else {
      const user = await prisma.user.findFirst({
        where: { id: payload.assignedToId, orgId: authResult.auth.orgId },
      });
      if (!user) {
        return jsonError("Assigned technician not found.", 404);
      }
      data.assignedToId = user.id;
    }
  }

  const updated = await prisma.taskInstance.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const existing = await prisma.taskInstance.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Task not found.", 404);
  }

  await prisma.taskInstance.delete({ where: { id: existing.id } });
  return NextResponse.json({ data: { id } });
}
