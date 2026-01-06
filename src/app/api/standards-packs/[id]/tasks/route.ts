import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, WorkPackageType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

type CreateTaskPayload = {
  title: string;
  description?: string | null;
  packageType?: WorkPackageType;
  sequenceNumber?: number;
  isCritical?: boolean;
  requiresEvidence?: boolean;
  estimatedMinutes?: number | null;
};

/**
 * GET /api/standards-packs/:id/tasks
 * List all tasks for a pack
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: packId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Verify pack exists in org
  const pack = await prisma.standardsPack.findFirst({
    where: { id: packId, orgId: authResult.auth.orgId },
    select: { id: true },
  });

  if (!pack) {
    return jsonError("Standards pack not found.", 404);
  }

  const tasks = await prisma.standardsPackTask.findMany({
    where: { standardsPackId: packId, orgId: authResult.auth.orgId },
    orderBy: [{ packageType: "asc" }, { sequenceNumber: "asc" }],
  });

  return NextResponse.json({ data: tasks });
}

/**
 * POST /api/standards-packs/:id/tasks
 * Add a task to a pack
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: packId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  // Verify pack exists in org
  const pack = await prisma.standardsPack.findFirst({
    where: { id: packId, orgId: authResult.auth.orgId },
    select: { id: true },
  });

  if (!pack) {
    return jsonError("Standards pack not found.", 404);
  }

  const body = await parseJson<CreateTaskPayload>(request);
  if (!body?.title?.trim()) {
    return jsonError("Task title is required.", 400);
  }

  // Get max sequence number for this package type
  const maxSeq = await prisma.standardsPackTask.aggregate({
    where: {
      standardsPackId: packId,
      packageType: body.packageType ?? "MECH_ELEC_UNIFIED",
    },
    _max: { sequenceNumber: true },
  });

  const task = await prisma.standardsPackTask.create({
    data: {
      orgId: authResult.auth.orgId,
      standardsPackId: packId,
      title: body.title.trim(),
      description: body.description?.trim() ?? null,
      packageType: body.packageType ?? "MECH_ELEC_UNIFIED",
      sequenceNumber: body.sequenceNumber ?? (maxSeq._max.sequenceNumber ?? 0) + 1,
      isCritical: body.isCritical ?? false,
      requiresEvidence: body.requiresEvidence ?? false,
      estimatedMinutes: body.estimatedMinutes ?? null,
    },
  });

  return NextResponse.json({ data: task }, { status: 201 });
}
