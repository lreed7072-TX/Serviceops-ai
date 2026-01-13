import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/procedure-templates/:id
 * Get a single template with its steps
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const template = await prisma.procedureTemplate.findFirst({
    where: {
      id,
      orgId: authResult.auth.orgId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      steps: {
        orderBy: { sequenceNumber: "asc" },
      },
      standardsPack: {
        select: { id: true, name: true },
      },
    },
  });

  if (!template) {
    return jsonError("Template not found.", 404);
  }

  return NextResponse.json({ data: template });
}

/**
 * DELETE /api/procedure-templates/:id
 * Archive a template (set status to ARCHIVED)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const template = await prisma.procedureTemplate.findFirst({
    where: {
      id,
      orgId: authResult.auth.orgId,
    },
  });

  if (!template) {
    return jsonError("Template not found.", 404);
  }

  // Archive instead of delete
  await prisma.procedureTemplate.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ ok: true });
}
