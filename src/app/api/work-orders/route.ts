import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth, requireRole } from "@/lib/auth";
import {
  ExecutionMode,
  Role,
  WorkOrderStatus,
  WorkPackageType,
} from "@prisma/client";

export const runtime = "nodejs";

type WorkOrderPayload = {
  customerId?: string;
  siteId?: string;
  assetId?: string | null;
  title?: string;
  description?: string | null;
  status?: WorkOrderStatus;
  executionMode?: ExecutionMode;
};

export async function GET(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const workOrders = await prisma.workOrder.findMany({
    where: { orgId: authResult.auth.orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: workOrders });
}

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<WorkOrderPayload>(request);
  if (!body?.customerId || !body?.siteId || !body?.title) {
    return jsonError("Customer ID, site ID, and title are required.");
  }

  const [customer, site, asset] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: body.customerId, orgId: authResult.auth.orgId },
    }),
    prisma.site.findFirst({
      where: { id: body.siteId, orgId: authResult.auth.orgId },
    }),
    body.assetId
      ? prisma.asset.findFirst({
          where: { id: body.assetId, orgId: authResult.auth.orgId },
        })
      : Promise.resolve(null),
  ]);

  if (!customer || !site) {
    return jsonError("Customer or site not found.", 404);
  }

  if (body.assetId && !asset) {
    return jsonError("Asset not found.", 404);
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      orgId: authResult.auth.orgId,
      customerId: customer.id,
      siteId: site.id,
      assetId: asset?.id ?? null,
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? WorkOrderStatus.OPEN,
      executionMode: body.executionMode ?? ExecutionMode.UNIFIED,
    },
  });

  const packageTemplates =
    workOrder.executionMode === ExecutionMode.MULTI_LANE
      ? [
          { type: WorkPackageType.MECHANICAL, name: "Mechanical" },
          { type: WorkPackageType.ELECTRICAL, name: "Electrical" },
          { type: WorkPackageType.CONTROLS, name: "Controls" },
          { type: WorkPackageType.INSTRUMENTATION, name: "Instrumentation" },
        ]
      : [{ type: WorkPackageType.MECH_ELEC_UNIFIED, name: "Mech/Electrical Unified" }];

  await prisma.workPackage.createMany({
    data: packageTemplates.map((pkg) => ({
      orgId: authResult.auth.orgId,
      workOrderId: workOrder.id,
      packageType: pkg.type,
      name: pkg.name,
    })),
  });

  return NextResponse.json({ data: workOrder }, { status: 201 });
}
