import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, VisitStatus } from "@prisma/client";
export const runtime = "nodejs";

type VisitPayload = {
  workOrderId?: string;
  assignedTechId?: string | null;
  scheduledFor?: string | null;
  status?: VisitStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  summary?: string | null;
  outcome?: string | null;
};

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const status = searchParams.get("status") as VisitStatus | null;
  const workOrderId = searchParams.get("workOrderId");

  const whereBase: any = { orgId: authResult.auth.orgId };
  if (authResult.auth.role === Role.TECH) {
    whereBase.assignedTechId = authResult.auth.userId;
  }
  if (status) whereBase.status = status;
  if (workOrderId) whereBase.workOrderId = workOrderId;

  const [visits, total] = await Promise.all([
    prisma.visit.findMany({
      where: whereBase,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.visit.count({ where: whereBase }),
  ]);

  return NextResponse.json({ data: visits, total, limit, offset });
}

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<VisitPayload>(request);
  if (!body?.workOrderId) {
    return jsonError("Work order ID is required.");
  }

  const [workOrder, assignedTech] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id: body.workOrderId, orgId: authResult.auth.orgId },
    }),
    body.assignedTechId
      ? prisma.user.findFirst({
          where: { id: body.assignedTechId, orgId: authResult.auth.orgId },
        })
      : Promise.resolve(null),
  ]);

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  if (body.assignedTechId && !assignedTech) {
    return jsonError("Assigned tech not found.", 404);
  }

      // Generate next Visit number like V00001 (per-org).
    // Concurrency: @@unique([orgId, visitNumber]) + retry on collision.
    let visit: any = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const last = await prisma.visit.findFirst({
        where: { orgId: authResult.auth.orgId, visitNumber: { not: null } },
        select: { visitNumber: true },
        orderBy: { createdAt: "desc" },
      });

      const lastStr = (last as any)?.visitNumber ?? null;
      const lastNum =
        lastStr && /^V(\d+)$/.test(lastStr) ? Number.parseInt(lastStr.slice(1), 10) : 0;

      const nextNum = lastNum + 1 + attempt;
      const visitNumber = `V${String(nextNum).padStart(5, "0")}`;

      try {
        visit = await prisma.visit.create({
          data: {
            orgId: authResult.auth.orgId,
            workOrderId: workOrder.id,
            visitNumber,
            assignedTechId: assignedTech?.id ?? null,
            status: body.status ?? VisitStatus.PLANNED,
            scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
            startedAt: body.startedAt ? new Date(body.startedAt) : null,
            completedAt: body.completedAt ? new Date(body.completedAt) : null,
            summary: body.summary ?? null,
            outcome: body.outcome ?? null,
          },
        });
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? "").toLowerCase();
        const isUnique = err?.code === "P2002" || msg.includes("unique");
        if (!isUnique || attempt === 4) throw err;
      }
    }

    if (!visit) {
      return jsonError("Unable to create visit.", 500);
    }



  return NextResponse.json({ data: visit }, { status: 201 });
}
