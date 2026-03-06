import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { Prisma, ReportTemplateStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/form-responses — List form responses for org
export async function GET(request: Request) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const url = new URL(request.url);
    const workOrderId = url.searchParams.get("workOrderId");
    const templateId = url.searchParams.get("templateId");
    const status = url.searchParams.get("status");
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
      200
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
      0
    );

    const where: Prisma.FormResponseWhereInput = { orgId: auth.orgId };
    if (workOrderId) where.workOrderId = workOrderId;
    if (templateId) where.reportTemplateId = templateId;
    if (status) where.status = status as Prisma.FormResponseWhereInput["status"];

    const [data, total] = await Promise.all([
      prisma.formResponse.findMany({
        where,
        include: {
          reportTemplate: { select: { id: true, name: true } },
          workOrder: {
            select: { id: true, workOrderNumber: true, title: true },
          },
          site: { select: { id: true, name: true } },
          asset: { select: { id: true, name: true } },
          filledBy: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.formResponse.count({ where }),
    ]);

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    console.error("Failed to list form responses:", error);
    return jsonError("Failed to list form responses", 500);
  }
}

// POST /api/form-responses — Create draft from template
export async function POST(request: Request) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const body = await parseJson<{
      reportTemplateId: string;
      workOrderId?: string;
      siteId?: string;
      assetId?: string;
    }>(request);

    if (!body?.reportTemplateId) {
      return jsonError("reportTemplateId is required", 400);
    }

    // Verify template exists in org and is ACTIVE
    const template = await prisma.reportTemplate.findUnique({
      where: { id: body.reportTemplateId },
      select: { id: true, name: true, definition: true, orgId: true, status: true },
    });

    if (!template || template.orgId !== auth.orgId) {
      return jsonError("Template not found", 404);
    }

    if (template.status !== ReportTemplateStatus.ACTIVE) {
      return jsonError("Template is not active", 400);
    }

    // Verify WO in org if provided
    if (body.workOrderId) {
      const wo = await prisma.workOrder.findUnique({
        where: { id: body.workOrderId },
        select: { id: true, orgId: true },
      });
      if (!wo || wo.orgId !== auth.orgId) {
        return jsonError("Work order not found", 404);
      }
    }

    const response = await prisma.formResponse.create({
      data: {
        orgId: auth.orgId,
        reportTemplateId: body.reportTemplateId,
        workOrderId: body.workOrderId ?? null,
        siteId: body.siteId ?? null,
        assetId: body.assetId ?? null,
        data: {},
        filledByUserId: auth.userId,
      },
      include: {
        reportTemplate: { select: { id: true, name: true, definition: true } },
      },
    });

    return NextResponse.json({ data: response }, { status: 201 });
  } catch (error) {
    console.error("Failed to create form response:", error);
    return jsonError("Failed to create form response", 500);
  }
}
