import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
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
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const auth = authResult.auth;

    const whereBase: any = { orgId: auth.orgId };
    if (auth.role === Role.TECH) {
      whereBase.OR = [
        { tasks: { some: { assignedToId: auth.userId } } },
        { visits: { some: { assignedTechId: auth.userId } } },
        { packages: { some: { leadTechId: auth.userId } } },
      ];
    }

    const workOrders = await prisma.workOrder.findMany({
      where: whereBase,

      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: workOrders });
  }

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const auth = authResult.auth;
  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<WorkOrderPayload>(request);
  if (!body?.customerId || !body?.siteId || !body?.title) {
    return jsonError("Customer ID, site ID, and title are required.");
  }

  const [customer, site, asset] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: body.customerId, orgId: auth.orgId },
    }),
    prisma.site.findFirst({
      where: { id: body.siteId, orgId: auth.orgId },
    }),
    body.assetId
      ? prisma.asset.findFirst({
          where: { id: body.assetId, orgId: auth.orgId },
        })
      : Promise.resolve(null),
  ]);

  if (!customer || !site) {
    return jsonError("Customer or site not found.", 404);
  }

  if (body.assetId && !asset) {
    return jsonError("Asset not found.", 404);
  }

    // Generate next Work Order number like WO00109 (per-org).
    // Concurrency: @@unique([orgId, workOrderNumber]) + retry on collision.
    let workOrder: any = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const last = await prisma.workOrder.findFirst({
        where: { orgId: auth.orgId, workOrderNumber: { not: null } },
        select: { workOrderNumber: true },
        orderBy: { createdAt: "desc" },
      });

      const lastStr = last?.workOrderNumber ?? null;
      const lastNum =
        lastStr && /^WO(\d+)$/.test(lastStr) ? Number.parseInt(lastStr.slice(2), 10) : 0;

      const nextNum = lastNum + 1 + attempt;
      const workOrderNumber = `WO${String(nextNum).padStart(5, "0")}`;

      try {
        workOrder = await prisma.workOrder.create({
          data: {
            orgId: auth.orgId,
            workOrderNumber,
            customerId: customer.id,
            siteId: site.id,
            assetId: asset?.id ?? null,
            title: body.title,
            description: body.description ?? null,
            status: body.status ?? WorkOrderStatus.OPEN,
            executionMode: body.executionMode ?? ExecutionMode.UNIFIED,
          },
        });
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? "").toLowerCase();
        const isUnique = err?.code === "P2002" || msg.includes("unique");
        if (!isUnique || attempt === 4) throw err;
      }
    }

    if (!workOrder) {
      return jsonError("Unable to create work order.", 500);
    }


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
      orgId: auth.orgId,
      workOrderId: workOrder.id,
      packageType: pkg.type,
      name: pkg.name,
    })),
  });

  return NextResponse.json({ data: workOrder }, { status: 201 });
}
