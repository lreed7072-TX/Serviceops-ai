import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

// ─── Types ───────────────────────────────────────────────────

type FollowUpUpdatePayload = {
  title?: string;
  description?: string | null;
  dueDate?: string;
  priority?: string;
  status?: string;
  assignedToUserId?: string;
  customerId?: string;
  contactId?: string | null;
  siteId?: string | null;
  callLogId?: string | null;
};

// ─── GET /api/follow-ups/[id] ────────────────────────────────
// Single follow-up by id, org-scoped. SALES + ADMIN + DISPATCHER can read. TECH → 403.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // TECH cannot access follow-ups
  if (auth.role === Role.TECH) {
    return jsonError("Insufficient permissions.", 403);
  }

  const where: any = { id, orgId: auth.orgId };

  // SALES can only see their own follow-ups
  if (auth.role === Role.SALES) {
    where.assignedToUserId = auth.userId;
  }

  const followUp = await prisma.followUp.findFirst({
    where,
    include: {
      customer: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { name: true } },
      createdBy: { select: { name: true } },
      callLog: { select: { id: true, subject: true } },
      site: { select: { id: true, name: true } },
    },
  });

  if (!followUp) return jsonError("Follow-up not found.", 404);

  return NextResponse.json({ data: followUp });
}

// ─── PUT /api/follow-ups/[id] ────────────────────────────────
// Update a follow-up. SALES + ADMIN can update.
// When status changes to COMPLETED, set completedAt.

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  const body = await parseJson<FollowUpUpdatePayload>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const existing = await prisma.followUp.findFirst({
    where: { id, orgId: auth.orgId },
  });
  if (!existing) return jsonError("Follow-up not found.", 404);

  // Build update data
  const updateData: any = {};

  if (body.title !== undefined) {
    updateData.title = body.title;
  }

  if (body.description !== undefined) {
    updateData.description = body.description;
  }

  if (body.dueDate !== undefined) {
    updateData.dueDate = new Date(body.dueDate);
  }

  if (body.priority !== undefined) {
    updateData.priority = body.priority;
  }

  if (body.status !== undefined) {
    updateData.status = body.status;

    // When status changes to COMPLETED, set completedAt
    if (body.status === "COMPLETED" && existing.status !== "COMPLETED") {
      updateData.completedAt = new Date();
    }

    // If status changes away from COMPLETED, clear completedAt
    if (body.status !== "COMPLETED" && existing.status === "COMPLETED") {
      updateData.completedAt = null;
    }
  }

  if (body.assignedToUserId !== undefined) {
    const assignedUser = await prisma.user.findFirst({
      where: { id: body.assignedToUserId, orgId: auth.orgId },
    });
    if (!assignedUser) return jsonError("Assigned user not found.", 404);
    updateData.assignedToUserId = body.assignedToUserId;
  }

  if (body.customerId !== undefined) {
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, orgId: auth.orgId },
    });
    if (!customer) return jsonError("Customer not found.", 404);
    updateData.customerId = body.customerId;
  }

  if (body.contactId !== undefined) {
    if (body.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: body.contactId, orgId: auth.orgId },
      });
      if (!contact) return jsonError("Contact not found.", 404);
    }
    updateData.contactId = body.contactId;
  }

  if (body.siteId !== undefined) {
    if (body.siteId) {
      const site = await prisma.site.findFirst({
        where: { id: body.siteId, orgId: auth.orgId },
      });
      if (!site) return jsonError("Site not found.", 404);
    }
    updateData.siteId = body.siteId;
  }

  if (body.callLogId !== undefined) {
    if (body.callLogId) {
      const callLog = await prisma.callLog.findFirst({
        where: { id: body.callLogId, orgId: auth.orgId },
      });
      if (!callLog) return jsonError("Call log not found.", 404);
    }
    updateData.callLogId = body.callLogId;
  }

  const followUp = await prisma.followUp.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { name: true } },
      createdBy: { select: { name: true } },
      callLog: { select: { id: true, subject: true } },
      site: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: followUp });
}

// ─── DELETE /api/follow-ups/[id] ─────────────────────────────
// Delete a follow-up. SALES + ADMIN can delete.

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  const existing = await prisma.followUp.findFirst({
    where: { id, orgId: auth.orgId },
  });
  if (!existing) return jsonError("Follow-up not found.", 404);

  await prisma.followUp.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
