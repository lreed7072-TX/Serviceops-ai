import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type FollowUpTypePayload = {
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
    const followUpTypes = await prisma.followUpType.findMany({
      where: { orgId: auth.orgId },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ data: followUpTypes });
  } catch (err) {
    console.error("GET /api/crm/follow-up-types failed:", err);
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
    const body = await parseJson<FollowUpTypePayload>(request);
    if (!body?.name) {
      return jsonError("Name is required.");
    }

    const followUpType = await prisma.followUpType.create({
      data: {
        orgId: auth.orgId,
        name: body.name,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
      },
    });

    return NextResponse.json({ data: followUpType }, { status: 201 });
  } catch (err) {
    console.error("POST /api/crm/follow-up-types failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
