import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, WorkPackageType } from "@prisma/client";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type PackagePayload = {
  packageType?: WorkPackageType;
  name?: string;
  status?: string | null;
  leadTechId?: string | null;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

      const whereWO: any = { id, orgId: authResult.auth.orgId };
    if (authResult.auth.role === Role.TECH) {
      whereWO.OR = [
        { tasks: { some: { assignedToId: authResult.auth.userId } } },
        { visits: { some: { assignedTechId: authResult.auth.userId } } },
        { packages: { some: { leadTechId: authResult.auth.userId } } },
      ];
    }
    const workOrder = await prisma.workOrder.findFirst({ where: whereWO });
  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  const packages = await prisma.workPackage.findMany({
      where: {
        workOrderId: workOrder.id,
        orgId: authResult.auth.orgId,
        ...(authResult.auth.role === Role.TECH
          ? {
              OR: [
                { leadTechId: authResult.auth.userId },
                { tasks: { some: { assignedToId: authResult.auth.userId } } },
              ],
            }
          : {}),
      },

    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: packages });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });
  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  const body = await parseJson<PackagePayload>(request);
  if (!body?.packageType || !body?.name) {
    return jsonError("Package type and name are required.");
  }

  const leadTech =
    body.leadTechId && body.leadTechId.length > 0
      ? await prisma.user.findFirst({
          where: { id: body.leadTechId, orgId: authResult.auth.orgId },
        })
      : null;

  if (body.leadTechId && !leadTech) {
    return jsonError("Lead technician not found.", 404);
  }

  const workPackage = await prisma.workPackage.create({
    data: {
      orgId: authResult.auth.orgId,
      workOrderId: workOrder.id,
      packageType: body.packageType,
      name: body.name,
      status: body.status ?? "PLANNED",
      leadTechId: leadTech?.id ?? null,
    },
  });

  return NextResponse.json({ data: workPackage }, { status: 201 });
}
