import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { ReportTemplateStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/form-templates/sync — All ACTIVE templates for org (mobile cache)
export async function GET(request: Request) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const data = await prisma.reportTemplate.findMany({
      where: {
        orgId: auth.orgId,
        status: ReportTemplateStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        description: true,
        definition: true,
        schemaVersion: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to sync form templates:", error);
    return jsonError("Failed to sync form templates", 500);
  }
}
