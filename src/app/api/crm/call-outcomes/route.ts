import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type CallOutcomePayload = {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  triggersFollowUp?: boolean;
  triggersOpportunityPrompt?: boolean;
};

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const callOutcomes = await prisma.callOutcome.findMany({
      where: { orgId: auth.orgId },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ data: callOutcomes });
  } catch (err) {
    console.error("GET /api/crm/call-outcomes failed:", err);
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
    const body = await parseJson<CallOutcomePayload>(request);
    if (!body?.name) {
      return jsonError("Name is required.");
    }

    const callOutcome = await prisma.callOutcome.create({
      data: {
        orgId: auth.orgId,
        name: body.name,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
        triggersFollowUp: body.triggersFollowUp ?? false,
        triggersOpportunityPrompt: body.triggersOpportunityPrompt ?? false,
      },
    });

    return NextResponse.json({ data: callOutcome }, { status: 201 });
  } catch (err) {
    console.error("POST /api/crm/call-outcomes failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
