import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { ReportTemplateStatus, Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/work-orders/[id]/reports — List form responses for this WO
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    const data = await prisma.formResponse.findMany({
      where: { workOrderId: id, orgId: auth.orgId },
      include: {
        reportTemplate: { select: { id: true, name: true } },
        filledBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to list WO reports:", error);
    return jsonError("Failed to list work order reports", 500);
  }
}

// POST /api/work-orders/[id]/reports — Assign template to WO
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
    if (roleError) return roleError;

    const { id } = await params;

    const body = await parseJson<{ reportTemplateId: string }>(request);
    if (!body?.reportTemplateId) {
      return jsonError("reportTemplateId is required", 400);
    }

    // Verify WO exists in org
    const wo = await prisma.workOrder.findUnique({
      where: { id, orgId: auth.orgId },
      select: { id: true, siteId: true, assetId: true },
    });

    if (!wo) {
      return jsonError("Work order not found", 404);
    }

    // Verify template is ACTIVE and in org
    const template = await prisma.reportTemplate.findUnique({
      where: { id: body.reportTemplateId },
      select: { id: true, orgId: true, status: true },
    });

    if (!template || template.orgId !== auth.orgId) {
      return jsonError("Template not found", 404);
    }

    if (template.status !== ReportTemplateStatus.ACTIVE) {
      return jsonError("Template is not active", 400);
    }

    // Create FormResponse with siteId and assetId auto-filled from the work order
    const response = await prisma.formResponse.create({
      data: {
        orgId: auth.orgId,
        reportTemplateId: body.reportTemplateId,
        workOrderId: id,
        siteId: wo.siteId,
        assetId: wo.assetId ?? null,
        data: {},
        filledByUserId: auth.userId,
      },
      include: {
        reportTemplate: { select: { id: true, name: true } },
        filledBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: response }, { status: 201 });
  } catch (error) {
    console.error("Failed to assign template to WO:", error);
    return jsonError("Failed to assign template to work order", 500);
  }
}
