import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// GET /api/call-logs — list call logs with pagination & filters
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // TECH users cannot access call logs
  const techBlock = requireRole(auth, [Role.ADMIN, Role.SALES, Role.DISPATCHER]);
  if (techBlock) return techBlock;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const userId = searchParams.get("userId");
  const customerId = searchParams.get("customerId");
  const callTypeId = searchParams.get("callTypeId");
  const callOutcomeId = searchParams.get("callOutcomeId");

  const where: any = { orgId: auth.orgId };

  // SALES users see only their own call logs
  if (auth.role === Role.SALES) {
    where.userId = auth.userId;
  } else if (userId) {
    where.userId = userId;
  }

  if (customerId) where.customerId = customerId;
  if (callTypeId) where.callTypeId = callTypeId;
  if (callOutcomeId) where.callOutcomeId = callOutcomeId;

  const [callLogs, total] = await Promise.all([
    prisma.callLog.findMany({
      where,
      orderBy: { callTimestamp: "desc" },
      take: limit,
      skip: offset,
      include: {
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
      },
    }),
    prisma.callLog.count({ where }),
  ]);

  return NextResponse.json({ data: callLogs, total, limit, offset });
}

type CallLogPayload = {
  customerId?: string;
  siteId?: string;
  contactId?: string;
  callTypeId?: string;
  callOutcomeId?: string;
  callMethod?: string;
  callDuration?: number;
  competitorMentioned?: string;
  notes?: string;
  callTimestamp?: string;
};

// POST /api/call-logs — create a call log
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Only SALES + ADMIN can create call logs
  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  const body = await parseJson<CallLogPayload>(request);

  if (!body?.customerId) return jsonError("customerId is required.");
  if (!body?.callTypeId) return jsonError("callTypeId is required.");
  if (!body?.callOutcomeId) return jsonError("callOutcomeId is required.");
  if (!body?.callMethod) return jsonError("callMethod is required.");
  if (!body?.callTimestamp) return jsonError("callTimestamp is required.");

  // Validate customer belongs to this org
  const customer = await prisma.customer.findFirst({
    where: { id: body.customerId, orgId: auth.orgId },
  });
  if (!customer) return jsonError("Customer not found.", 404);

  // Validate callType belongs to this org
  const callType = await prisma.callType.findFirst({
    where: { id: body.callTypeId, orgId: auth.orgId },
  });
  if (!callType) return jsonError("Call type not found.", 404);

  // Validate callOutcome belongs to this org
  const callOutcome = await prisma.callOutcome.findFirst({
    where: { id: body.callOutcomeId, orgId: auth.orgId },
  });
  if (!callOutcome) return jsonError("Call outcome not found.", 404);

  // Validate optional site belongs to this org
  if (body.siteId) {
    const site = await prisma.site.findFirst({
      where: { id: body.siteId, orgId: auth.orgId },
    });
    if (!site) return jsonError("Site not found.", 404);
  }

  // Validate optional contact belongs to this org and customer
  if (body.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, orgId: auth.orgId, customerId: body.customerId },
    });
    if (!contact) return jsonError("Contact not found.", 404);
  }

  const callLog = await prisma.callLog.create({
    data: {
      orgId: auth.orgId,
      userId: auth.userId,
      customerId: body.customerId,
      siteId: body.siteId ?? null,
      contactId: body.contactId ?? null,
      callTypeId: body.callTypeId,
      callOutcomeId: body.callOutcomeId,
      callMethod: body.callMethod as any,
      callDuration: body.callDuration ?? null,
      competitorMentioned: body.competitorMentioned ?? null,
      notes: body.notes ?? null,
      callTimestamp: new Date(body.callTimestamp),
    },
    include: {
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
    },
  });

  return NextResponse.json({ data: callLog }, { status: 201 });
}
