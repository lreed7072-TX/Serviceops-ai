import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type CreateStepPayload = {
  title: string;
  description?: string;
  domain?: string;
  isCritical?: boolean;
  requiresEvidence?: boolean;
  estimatedMinutes?: number;
  sequenceNumber?: number;
};

/**
 * POST /api/procedure-templates/:id/steps
 * Create a new step in the template
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: templateId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  // Verify template exists and belongs to org
  const template = await prisma.procedureTemplate.findFirst({
    where: {
      id: templateId,
      orgId: authResult.auth.orgId,
    },
  });

  if (!template) {
    return jsonError("Template not found.", 404);
  }

  const body = await parseJson<CreateStepPayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.", 400);
  }

  if (!body.title?.trim()) {
    return jsonError("Step title is required.", 400);
  }

  // Get max sequence number
  const maxSeq = await prisma.procedureStepTemplate.aggregate({
    where: { procedureTemplateId: templateId },
    _max: { sequenceNumber: true },
  });

  const step = await prisma.procedureStepTemplate.create({
    data: {
      orgId: authResult.auth.orgId,
      procedureTemplateId: templateId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      domain: body.domain || null,
      isCritical: body.isCritical || false,
      requiresEvidence: body.requiresEvidence || false,
      estimatedMinutes: body.estimatedMinutes || null,
      sequenceNumber: body.sequenceNumber ?? (maxSeq._max.sequenceNumber || 0) + 1,
    },
  });

  return NextResponse.json({ data: step });
}
