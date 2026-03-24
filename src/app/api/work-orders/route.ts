import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import {
  ExecutionMode,
  OrderType,
  Role,
  WorkOrderStatus,
  WorkPackageType,
} from "@prisma/client";
import { triggerWorkOrderCreated } from "@/lib/ai/ai-triggers";

export const runtime = "nodejs";

type WorkOrderPayload = {
  customerId?: string;
  siteId?: string;
  assetId?: string | null;
  title?: string;
  description?: string | null;
  status?: WorkOrderStatus;
  executionMode?: ExecutionMode;
  orderType?: OrderType;
};

// Prefix mapping for order types
const ORDER_TYPE_PREFIX: Record<OrderType, string> = {
  WORK_ORDER: "WO",
  SALES_ORDER: "SO",
  PROJECT: "PJ",
};

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const auth = authResult.auth;

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("orderType") as OrderType | null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  const whereBase: any = { orgId: auth.orgId };

  if (typeFilter && Object.values(OrderType).includes(typeFilter)) {
    whereBase.orderType = typeFilter;
  }

  if (auth.role === Role.TECH) {
    whereBase.OR = [
      { tasks: { some: { assignedToId: auth.userId } } },
      { visits: { some: { assignedTechId: auth.userId } } },
      { packages: { some: { leadTechId: auth.userId } } },
    ];
  }

  const [workOrders, total] = await Promise.all([
    prisma.workOrder.findMany({
      where: whereBase,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        customer: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        tasks: { select: { id: true, status: true } },
      },
    }),
    prisma.workOrder.count({ where: whereBase }),
  ]);

  return NextResponse.json({ data: workOrders, total, limit, offset });
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

  const orderType = body.orderType ?? OrderType.WORK_ORDER;
  const prefix = ORDER_TYPE_PREFIX[orderType];

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

  // Generate next order number with correct prefix (per-org, per-type)
  let workOrder: any = null;

  // Find highest existing number for this prefix (handles legacy date-based formats)
  const allWithPrefix = await prisma.workOrder.findMany({
    where: {
      orgId: auth.orgId,
      orderType,
      workOrderNumber: { startsWith: prefix },
    },
    select: { workOrderNumber: true },
  });

  const regex = new RegExp(`^${prefix}-?(\\d+)(?:-.*)?$`);
  let maxNum = 0;
  for (const row of allWithPrefix) {
    const match = row.workOrderNumber?.match(regex);
    if (match) {
      const num = Number.parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nextNum = maxNum + 1 + attempt;
    const workOrderNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;

    try {
      workOrder = await prisma.workOrder.create({
        data: {
          orgId: auth.orgId,
          workOrderNumber,
          orderType,
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
    return jsonError("Unable to create order.", 500);
  }

  // Create default packages
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

  // Fire AI analysis trigger (fire-and-forget)
  triggerWorkOrderCreated(auth.orgId, workOrder.id).catch(console.error);

  return NextResponse.json({ data: workOrder }, { status: 201 });
}
