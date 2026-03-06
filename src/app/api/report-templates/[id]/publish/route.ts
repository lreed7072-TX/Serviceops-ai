import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { ReportTemplateStatus, Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/report-templates/[id]/publish — Publish template
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleError = requireRole(auth, [Role.ADMIN]);
    if (roleError) return roleError;

    const { id } = await params;

    const template = await prisma.reportTemplate.findUnique({
      where: { id, orgId: auth.orgId },
      select: { id: true, schemaVersion: true, status: true },
    });

    if (!template) {
      return jsonError("Template not found", 404);
    }

    const updated = await prisma.reportTemplate.update({
      where: { id },
      data: {
        schemaVersion: template.schemaVersion + 1,
        status: ReportTemplateStatus.ACTIVE,
        updatedByUserId: auth.userId,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Failed to publish template:", error);
    return jsonError("Failed to publish template", 500);
  }
}
