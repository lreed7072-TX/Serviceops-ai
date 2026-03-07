import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type LeadSourcePayload = {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
};

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const leadSources = await prisma.leadSource.findMany({
      where: { orgId: auth.orgId },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ data: leadSources });
  } catch (err) {
    console.error("GET /api/crm/lead-sources failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  try {
    const body = await parseJson<LeadSourcePayload>(request);
    if (!body?.name) {
      return jsonError("Name is required.");
    }

    const leadSource = await prisma.leadSource.create({
      data: {
        orgId: auth.orgId,
        name: body.name,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
      },
    });

    return NextResponse.json({ data: leadSource }, { status: 201 });
  } catch (err) {
    console.error("POST /api/crm/lead-sources failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
