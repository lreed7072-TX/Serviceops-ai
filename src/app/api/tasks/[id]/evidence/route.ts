import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TaskEvidenceType } from "@prisma/client";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const taskIdSchema = z.union([z.string().uuid(), z.string().cuid()]);

const taskEvidenceSchema = z.object({
  type: z.literal(TaskEvidenceType.NOTE),
  noteText: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const parsedId = taskIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Task ID must be a valid UUID or CUID.", 400);
  }

  const task = await prisma.taskInstance.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  const body = await parseJson<unknown>(request);
  const parsedBody = taskEvidenceSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return jsonError("Invalid evidence payload.", 400);
  }

  const evidence = await prisma.taskEvidence.create({
    data: {
      orgId: authResult.auth.orgId,
      taskInstanceId: task.id,
      type: TaskEvidenceType.NOTE,
      noteText: parsedBody.data.noteText,
      createdByUserId: authResult.auth.userId,
    },
  });

  return NextResponse.json({ data: evidence });
}
