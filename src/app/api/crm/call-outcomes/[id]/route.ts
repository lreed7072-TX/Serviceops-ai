import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type CallOutcomeUpdatePayload = {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  triggersFollowUp?: boolean;
  triggersOpportunityPrompt?: boolean;
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
    const callOutcome = await prisma.callOutcome.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!callOutcome) {
      return jsonError("Call outcome not found.", 404);
    }

    return NextResponse.json({ data: callOutcome });
  } catch (err) {
    console.error("GET /api/crm/call-outcomes/[id] failed:", err);
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
    const body = await parseJson<CallOutcomeUpdatePayload>(request);
    if (!body) {
      return jsonError("Invalid JSON body.");
    }

    const existing = await prisma.callOutcome.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return jsonError("Call outcome not found.", 404);
    }

    const callOutcome = await prisma.callOutcome.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        displayOrder: body.displayOrder ?? existing.displayOrder,
        isActive: body.isActive ?? existing.isActive,
        isDefault: body.isDefault ?? existing.isDefault,
        triggersFollowUp: body.triggersFollowUp ?? existing.triggersFollowUp,
        triggersOpportunityPrompt: body.triggersOpportunityPrompt ?? existing.triggersOpportunityPrompt,
      },
    });

    return NextResponse.json({ data: callOutcome });
  } catch (err) {
    console.error("PUT /api/crm/call-outcomes/[id] failed:", err);
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
    const existing = await prisma.callOutcome.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return jsonError("Call outcome not found.", 404);
    }

    await prisma.callOutcome.delete({ where: { id } });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error("DELETE /api/crm/call-outcomes/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
