import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// ─── Types ───────────────────────────────────────────────────

type FollowUpCreatePayload = {
  customerId: string;
  assignedToUserId: string;
  title: string;
  dueDate: string;
  callLogId?: string;
  siteId?: string;
  contactId?: string;
  description?: string;
  priority?: string;
};

// ─── GET /api/follow-ups ─────────────────────────────────────
// List follow-ups with pagination and filters.
// ADMIN sees all. SALES sees only their own. DISPATCHER read-only (sees all). TECH → 403.

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // TECH cannot access follow-ups
  if (auth.role === Role.TECH) {
    return jsonError("Insufficient permissions.", 403);
  }

  const { searchParams } = new URL(request.url);
  const assignedToUserId = searchParams.get("assignedToUserId");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const where: any = {
    orgId: auth.orgId,
  };

  // SALES can only see follow-ups assigned to themselves
  if (auth.role === Role.SALES) {
    where.assignedToUserId = auth.userId;
  }

  // Filter overrides (ADMIN/DISPATCHER can filter by assignee)
  if (assignedToUserId && auth.role !== Role.SALES) {
    where.assignedToUserId = assignedToUserId;
  }

  if (status) {
    where.status = status;
  }

  if (priority) {
    where.priority = priority;
  }

  const [followUps, total] = await Promise.all([
    prisma.followUp.findMany({
      where,
      orderBy: { dueDate: "asc" },
      include: {
        customer: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
      },
      take: limit,
      skip: offset,
    }),
    prisma.followUp.count({ where }),
  ]);

  return NextResponse.json({ data: followUps, total, limit, offset });
}

// ─── POST /api/follow-ups ────────────────────────────────────
// Create a follow-up. SALES + ADMIN can create.

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  const body = await parseJson<FollowUpCreatePayload>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const { customerId, assignedToUserId, title, dueDate } = body;

  if (!customerId || !assignedToUserId || !title || !dueDate) {
    return jsonError("customerId, assignedToUserId, title, and dueDate are required.", 400);
  }

  // Verify customer belongs to org
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId: auth.orgId },
  });
  if (!customer) return jsonError("Customer not found.", 404);

  // Verify assigned user belongs to org
  const assignedUser = await prisma.user.findFirst({
    where: { id: assignedToUserId, orgId: auth.orgId },
  });
  if (!assignedUser) return jsonError("Assigned user not found.", 404);

  // Verify optional relations belong to org
  if (body.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, orgId: auth.orgId },
    });
    if (!contact) return jsonError("Contact not found.", 404);
  }

  if (body.siteId) {
    const site = await prisma.site.findFirst({
      where: { id: body.siteId, orgId: auth.orgId },
    });
    if (!site) return jsonError("Site not found.", 404);
  }

  if (body.callLogId) {
    const callLog = await prisma.callLog.findFirst({
      where: { id: body.callLogId, orgId: auth.orgId },
    });
    if (!callLog) return jsonError("Call log not found.", 404);
  }

  const followUp = await prisma.followUp.create({
    data: {
      orgId: auth.orgId,
      customerId,
      assignedToUserId,
      createdByUserId: auth.userId,
      title,
      dueDate: new Date(dueDate),
      description: body.description ?? null,
      priority: (body.priority as any) ?? "NORMAL",
      callLogId: body.callLogId ?? null,
      siteId: body.siteId ?? null,
      contactId: body.contactId ?? null,
    },
    include: {
      customer: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { name: true } },
    },
  });

  return NextResponse.json({ data: followUp }, { status: 201 });
}
