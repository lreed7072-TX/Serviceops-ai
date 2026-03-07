import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, WorkOrderStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/service-tickets/[id]/convert-to-work-order
 * Convert a service ticket into a Work Order.
 * ADMIN + DISPATCHER can convert.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  // Lookup the ticket with customer and site
  const ticket = await prisma.serviceTicket.findFirst({
    where: { id, orgId: auth.orgId },
    include: {
      customer: true,
      site: true,
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Service ticket not found." }, { status: 404 });
  }

  // Check if already converted
  if (ticket.convertedWorkOrderId) {
    return jsonError("Ticket already converted to work order.", 400);
  }

  // Check if ticket status allows conversion
  if (ticket.status === "CONVERTED" || ticket.status === "CLOSED") {
    return jsonError(
      `Cannot convert ticket with status ${ticket.status}.`,
      400
    );
  }

  // Site is required to create a work order
  if (!ticket.siteId) {
    return jsonError("Site is required to create a work order.", 400);
  }

  // Generate work order number: count existing WOs for the org + 1, formatted as WO-XXXX
  const woCount = await prisma.workOrder.count({
    where: { orgId: auth.orgId },
  });
  const workOrderNumber = `WO-${String(woCount + 1).padStart(4, "0")}`;

  // Create the work order and update the ticket in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.create({
      data: {
        orgId: auth.orgId,
        customerId: ticket.customerId,
        siteId: ticket.siteId!,
        title: ticket.reasonForService,
        description: ticket.notes || null,
        status: WorkOrderStatus.OPEN,
        workOrderNumber,
        createdByUserId: auth.userId,
      },
    });

    // Update the ticket: link to work order + set status to CONVERTED
    await tx.serviceTicket.update({
      where: { id: ticket.id },
      data: {
        convertedWorkOrderId: workOrder.id,
        status: "CONVERTED",
      },
    });

    // Create a notification for the ticket creator (salesperson)
    await tx.notification.create({
      data: {
        orgId: auth.orgId,
        userId: ticket.createdByUserId,
        type: "SERVICE_TICKET_CONVERTED",
        title: "Service Ticket Converted",
        message: `Your service ticket has been converted to Work Order ${workOrderNumber}`,
        actionUrl: `/work-orders/${workOrder.id}`,
        metadata: JSON.stringify({ workOrderId: workOrder.id, ticketId: ticket.id }),
      },
    });

    return workOrder;
  });

  return NextResponse.json(
    {
      data: {
        workOrderId: result.id,
        workOrderNumber: result.workOrderNumber,
      },
    },
    { status: 201 }
  );
}
