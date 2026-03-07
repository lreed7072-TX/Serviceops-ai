import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

const callLogIncludes = {
  customer: { select: { name: true } },
  contact: { select: { firstName: true, lastName: true } },
  callType: { select: { name: true } },
  callOutcome: {
    select: {
      name: true,
      triggersFollowUp: true,
      triggersOpportunityPrompt: true,
    },
  },
  user: { select: { name: true } },
  site: { select: { id: true, name: true } },
};

// GET /api/call-logs/[id] — single call log by id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // SALES + ADMIN + DISPATCHER can read. TECH returns 403.
  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES, Role.DISPATCHER]);
  if (roleError) return roleError;

  const callLog = await prisma.callLog.findFirst({
    where: { id, orgId: auth.orgId },
    include: callLogIncludes,
  });

  if (!callLog) return jsonError("Call log not found.", 404);

  return NextResponse.json({ data: callLog });
}

type CallLogUpdatePayload = {
  customerId?: string;
  siteId?: string | null;
  contactId?: string | null;
  callTypeId?: string;
  callOutcomeId?: string;
  callMethod?: string;
  callDuration?: number | null;
  competitorMentioned?: string | null;
  notes?: string | null;
  callTimestamp?: string;
};

// PUT /api/call-logs/[id] — update a call log
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Only SALES + ADMIN can update
  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  // Fetch existing call log (org-scoped)
  const existing = await prisma.callLog.findFirst({
    where: { id, orgId: auth.orgId },
  });

  if (!existing) return jsonError("Call log not found.", 404);

  // SALES can only update their own logs
  if (auth.role === Role.SALES && existing.userId !== auth.userId) {
    return jsonError("You can only update your own call logs.", 403);
  }

  const body = await parseJson<CallLogUpdatePayload>(request);
  if (!body) return jsonError("Request body is required.");

  const updateData: any = {};

  // Validate and set customerId
  if (body.customerId !== undefined) {
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, orgId: auth.orgId },
    });
    if (!customer) return jsonError("Customer not found.", 404);
    updateData.customerId = body.customerId;
  }

  // Validate and set callTypeId
  if (body.callTypeId !== undefined) {
    const callType = await prisma.callType.findFirst({
      where: { id: body.callTypeId, orgId: auth.orgId },
    });
    if (!callType) return jsonError("Call type not found.", 404);
    updateData.callTypeId = body.callTypeId;
  }

  // Validate and set callOutcomeId
  if (body.callOutcomeId !== undefined) {
    const callOutcome = await prisma.callOutcome.findFirst({
      where: { id: body.callOutcomeId, orgId: auth.orgId },
    });
    if (!callOutcome) return jsonError("Call outcome not found.", 404);
    updateData.callOutcomeId = body.callOutcomeId;
  }

  // Validate and set siteId
  if (body.siteId !== undefined) {
    if (body.siteId !== null) {
      const site = await prisma.site.findFirst({
        where: { id: body.siteId, orgId: auth.orgId },
      });
      if (!site) return jsonError("Site not found.", 404);
    }
    updateData.siteId = body.siteId;
  }

  // Validate and set contactId
  if (body.contactId !== undefined) {
    if (body.contactId !== null) {
      const resolvedCustomerId = updateData.customerId ?? existing.customerId;
      const contact = await prisma.contact.findFirst({
        where: { id: body.contactId, orgId: auth.orgId, customerId: resolvedCustomerId },
      });
      if (!contact) return jsonError("Contact not found.", 404);
    }
    updateData.contactId = body.contactId;
  }

  if (body.callMethod !== undefined) updateData.callMethod = body.callMethod;
  if (body.callDuration !== undefined) updateData.callDuration = body.callDuration;
  if (body.competitorMentioned !== undefined) updateData.competitorMentioned = body.competitorMentioned;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.callTimestamp !== undefined) updateData.callTimestamp = new Date(body.callTimestamp);

  const callLog = await prisma.callLog.update({
    where: { id },
    data: updateData,
    include: callLogIncludes,
  });

  return NextResponse.json({ data: callLog });
}
