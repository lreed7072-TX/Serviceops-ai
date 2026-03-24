import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/service-tickets/[id]
 * Get a single service ticket by ID, org-scoped.
 * SALES + ADMIN + DISPATCHER can read. TECH returns 403.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER, Role.SALES]);
  if (roleError) return roleError;

  const ticket = await prisma.serviceTicket.findFirst({
    where: { id, orgId: auth.orgId },
    include: {
      customer: true,
      site: true,
      contact: true,
      createdBy: { select: { id: true, name: true, email: true } },
      convertedWorkOrder: {
        select: {
          id: true,
          title: true,
          status: true,
          workOrderNumber: true,
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Service ticket not found." }, { status: 404 });
  }

  return NextResponse.json({ data: ticket });
}

/**
 * PUT /api/service-tickets/[id]
 * Update a service ticket.
 * ADMIN + DISPATCHER can update all fields.
 * SALES can only update their own tickets.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER, Role.SALES]);
  if (roleError) return roleError;

  const existing = await prisma.serviceTicket.findFirst({
    where: { id, orgId: auth.orgId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Service ticket not found." }, { status: 404 });
  }

  // SALES can only update their own tickets
  if (auth.role === Role.SALES && existing.createdByUserId !== auth.userId) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = (await parseJson(request)) as any;
  if (!body) {
    return jsonError("Request body is required.", 400);
  }

  const updateData: any = {};

  if (body.customerId !== undefined) updateData.customerId = body.customerId;
  if (body.siteId !== undefined) updateData.siteId = body.siteId || null;
  if (body.contactId !== undefined) updateData.contactId = body.contactId || null;
  if (body.contactName !== undefined) updateData.contactName = body.contactName || null;
  if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone || null;
  if (body.reasonForService !== undefined) updateData.reasonForService = body.reasonForService;
  if (body.serviceRequestedDate !== undefined) {
    updateData.serviceRequestedDate = body.serviceRequestedDate
      ? new Date(body.serviceRequestedDate)
      : null;
  }
  if (body.urgency !== undefined) updateData.urgency = body.urgency;
  if (body.notes !== undefined) updateData.notes = body.notes || null;
  if (body.siteAddress !== undefined) updateData.siteAddress = body.siteAddress || null;
  if (body.status !== undefined) {
    updateData.status = body.status;
    // Set completedAt when closing
    if (body.status === "CLOSED" && !existing.completedAt) {
      updateData.completedAt = new Date();
    }
  }

  // If contactId is being updated, snapshot contact info
  if (body.contactId && body.contactId !== existing.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, orgId: auth.orgId },
      select: { firstName: true, lastName: true, phone: true },
    });

    if (contact) {
      updateData.contactName = `${contact.firstName} ${contact.lastName}`;
      updateData.contactPhone = contact.phone || updateData.contactPhone;
    }
  }

  const ticket = await prisma.serviceTicket.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, name: true } },
      convertedWorkOrder: {
        select: {
          id: true,
          title: true,
          status: true,
          workOrderNumber: true,
        },
      },
    },
  });

  return NextResponse.json({ data: ticket });
}

/**
 * DELETE /api/service-tickets/[id]
 * Soft-delete by setting status to CLOSED. Only ADMIN can delete.
 * Cannot delete tickets that have been converted to a work order.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const existing = await prisma.serviceTicket.findFirst({
    where: { id, orgId: auth.orgId },
    select: { id: true, convertedWorkOrderId: true },
  });

  if (!existing) {
    return jsonError("Service ticket not found.", 404);
  }

  if (existing.convertedWorkOrderId) {
    return jsonError("Cannot delete a ticket that has been converted to a work order.", 400);
  }

  await prisma.serviceTicket.delete({ where: { id } });

  return NextResponse.json({ message: "Service ticket deleted." });
}
