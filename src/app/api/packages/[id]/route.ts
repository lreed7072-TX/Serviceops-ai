import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type PackageUpdatePayload = {
  name?: string;
  status?: string;
  leadTechId?: string | null;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const existing = await prisma.workPackage.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Work package not found.", 404);
  }

  const body = await parseJson<PackageUpdatePayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  let leadTechId: string | null | undefined = undefined;
  if (body.leadTechId !== undefined) {
    if (body.leadTechId === null || body.leadTechId.length === 0) {
      leadTechId = null;
    } else {
      const user = await prisma.user.findFirst({
        where: { id: body.leadTechId, orgId: authResult.auth.orgId },
      });
      if (!user) {
        return jsonError("Lead technician not found.", 404);
      }
      leadTechId = user.id;
    }
  }

  const updateData: {
    name?: string;
    status?: string;
    leadTechId?: string | null;
  } = {};

  if (body.name !== undefined) {
    updateData.name = body.name;
  }
  if (body.status !== undefined) {
    updateData.status = body.status;
  }
  if (leadTechId !== undefined) {
    updateData.leadTechId = leadTechId;
  }

  const updated = await prisma.workPackage.update({
    where: { id: existing.id },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
}
