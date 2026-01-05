import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TaskEvidenceType } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type EvidencePayload = {
  type: "NOTE" | "PHOTO" | "FILE";
  noteText?: string;
  url?: string;
};

/**
 * GET /api/tasks/:id/evidence
 * List all evidence for a task
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { auth } = authResult;

  // Verify task exists in org
  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: auth.orgId },
    select: { id: true },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  const evidence = await prisma.taskEvidence.findMany({
    where: { taskInstanceId: taskId, orgId: auth.orgId },
    orderBy: { createdAt: "desc" },
    include: {
      createdByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ data: evidence });
}

/**
 * POST /api/tasks/:id/evidence
 * Add evidence (note, photo URL, file URL) to a task
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { auth } = authResult;

  // Verify task exists in org
  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: auth.orgId },
    select: { id: true, assignedToId: true },
  });

  if (!task) {
    return jsonError("Task not found.", 404);
  }

  const body = await parseJson<EvidencePayload>(request);
  if (!body?.type) {
    return jsonError("Evidence type is required.", 400);
  }

  // Validate based on type
  if (body.type === "NOTE" && !body.noteText?.trim()) {
    return jsonError("Note text is required for NOTE type.", 400);
  }

  if ((body.type === "PHOTO" || body.type === "FILE") && !body.url?.trim()) {
    return jsonError("URL is required for PHOTO/FILE type.", 400);
  }

  const evidence = await prisma.taskEvidence.create({
    data: {
      orgId: auth.orgId,
      taskInstanceId: taskId,
      type: body.type as TaskEvidenceType,
      noteText: body.noteText?.trim() ?? null,
      url: body.url?.trim() ?? null,
      createdByUserId: auth.userId,
    },
  });

  return NextResponse.json({ data: evidence }, { status: 201 });
}
