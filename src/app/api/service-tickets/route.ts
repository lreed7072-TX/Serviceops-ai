import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/service-tickets
 * List service tickets with pagination.
 * ADMIN + DISPATCHER see all. SALES sees own only. TECH returns 403.
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // TECH cannot access service tickets
  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER, Role.SALES]);
  if (roleError) return roleError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const urgency = searchParams.get("urgency");
  const createdByUserId = searchParams.get("createdByUserId");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const where: any = {
    orgId: auth.orgId,
    ...(status && { status }),
    ...(urgency && { urgency }),
    ...(createdByUserId && { createdByUserId }),
  };

  // SALES role can only see their own tickets
  if (auth.role === Role.SALES) {
    where.createdByUserId = auth.userId;
  }

  const [tickets, total] = await Promise.all([
    prisma.serviceTicket.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, name: true } },
        convertedWorkOrder: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.serviceTicket.count({ where }),
  ]);

  return NextResponse.json({ data: tickets, total, limit, offset });
}

/**
 * POST /api/service-tickets
 * Create a new service ticket.
 * SALES + ADMIN can create.
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  const body = (await parseJson(request)) as any;
  if (!body?.customerId || !body?.reasonForService) {
    return jsonError("customerId and reasonForService are required.", 400);
  }

  // If contactId is provided, snapshot contact name and phone
  let contactName = body.contactName || null;
  let contactPhone = body.contactPhone || null;

  if (body.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, orgId: auth.orgId },
      select: { firstName: true, lastName: true, phone: true },
    });

    if (!contact) {
      return jsonError("Contact not found.", 404);
    }

    contactName = `${contact.firstName} ${contact.lastName}`;
    contactPhone = contact.phone || contactPhone;
  }

  const ticket = await prisma.serviceTicket.create({
    data: {
      orgId: auth.orgId,
      createdByUserId: auth.userId,
      customerId: body.customerId,
      siteId: body.siteId || null,
      contactId: body.contactId || null,
      contactName,
      contactPhone,
      reasonForService: body.reasonForService,
      serviceRequestedDate: body.serviceRequestedDate
        ? new Date(body.serviceRequestedDate)
        : null,
      urgency: body.urgency || undefined,
      notes: body.notes || null,
      siteAddress: body.siteAddress || null,
    },
    include: {
      customer: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: ticket }, { status: 201 });
}
