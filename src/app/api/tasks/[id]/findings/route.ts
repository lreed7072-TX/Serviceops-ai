import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { FindingPriority } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type FindingPayload = {
  category: string;
  details: string;
  priority?: string;
  photoUrl?: string;
};

const VALID_CATEGORIES = ["SAFETY", "DEFICIENCY", "RECOMMENDATION", "OBSERVATION"];

/**
 * GET /api/tasks/:id/findings
 * List all findings for a task
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: auth.orgId },
    select: { id: true },
  });
  if (!task) return jsonError("Task not found.", 404);

  const findings = await prisma.taskFinding.findMany({
    where: { taskInstanceId: taskId, orgId: auth.orgId },
    orderBy: { createdAt: "desc" },
    include: {
      createdByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ data: findings });
}

/**
 * POST /api/tasks/:id/findings
 * Add a finding to a task
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: taskId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const task = await prisma.taskInstance.findFirst({
    where: { id: taskId, orgId: auth.orgId },
    select: { id: true },
  });
  if (!task) return jsonError("Task not found.", 404);

  const body = await parseJson<FindingPayload>(request);
  if (!body?.category || !body?.details?.trim()) {
    return jsonError("Category and details are required.", 400);
  }
  if (!VALID_CATEGORIES.includes(body.category)) {
    return jsonError(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`, 400);
  }

  const priority = body.priority && Object.values(FindingPriority).includes(body.priority as FindingPriority)
    ? (body.priority as FindingPriority)
    : FindingPriority.MEDIUM;

  const finding = await prisma.taskFinding.create({
    data: {
      orgId: auth.orgId,
      taskInstanceId: taskId,
      category: body.category,
      details: body.details.trim(),
      priority,
      photoUrl: body.photoUrl?.trim() || null,
      createdByUserId: auth.userId,
    },
    include: {
      createdByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ data: finding }, { status: 201 });
}
