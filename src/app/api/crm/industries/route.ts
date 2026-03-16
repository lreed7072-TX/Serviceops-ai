import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type IndustryPayload = {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
};

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const industries = await prisma.industry.findMany({
      where: { orgId: auth.orgId },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ data: industries });
  } catch (err) {
    console.error("GET /api/crm/industries failed:", err);
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
    const body = await parseJson<IndustryPayload>(request);
    if (!body?.name) {
      return jsonError("Name is required.");
    }

    const industry = await prisma.industry.create({
      data: {
        orgId: auth.orgId,
        name: body.name,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({ data: industry }, { status: 201 });
  } catch (err) {
    console.error("POST /api/crm/industries failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
