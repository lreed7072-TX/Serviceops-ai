import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type IndustryUpdatePayload = {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const industry = await prisma.industry.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!industry) {
      return jsonError("Industry not found.", 404);
    }

    return NextResponse.json({ data: industry });
  } catch (err) {
    console.error("GET /api/crm/industries/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  try {
    const body = await parseJson<IndustryUpdatePayload>(request);
    if (!body) {
      return jsonError("Invalid JSON body.");
    }

    const existing = await prisma.industry.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return jsonError("Industry not found.", 404);
    }

    const industry = await prisma.industry.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        displayOrder: body.displayOrder ?? existing.displayOrder,
        isActive: body.isActive ?? existing.isActive,
      },
    });

    return NextResponse.json({ data: industry });
  } catch (err) {
    console.error("PUT /api/crm/industries/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  try {
    const existing = await prisma.industry.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return jsonError("Industry not found.", 404);
    }

    await prisma.industry.delete({ where: { id } });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error("DELETE /api/crm/industries/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
