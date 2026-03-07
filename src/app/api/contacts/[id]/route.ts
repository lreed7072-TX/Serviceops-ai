import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type ContactUpdatePayload = {
  firstName?: string;
  lastName?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  preferredContactMethod?: string | null;
  isDecisionMaker?: boolean;
  isTechnicalInfluencer?: boolean;
  isGatekeeper?: boolean;
  isPrimary?: boolean;
  notes?: string | null;
  status?: string;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/contacts/[id]
 * Get a single contact by ID
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER, Role.SALES]);
  if (roleError) return roleError;

  try {
    const contact = await prisma.contact.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        customer: {
          select: { name: true },
        },
      },
    });

    if (!contact) {
      return jsonError("Contact not found.", 404);
    }

    return NextResponse.json({ data: contact });
  } catch (err) {
    console.error("GET /api/contacts/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

/**
 * PUT /api/contacts/[id]
 * Update a contact
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  try {
    const body = await parseJson<ContactUpdatePayload>(request);
    if (!body) {
      return jsonError("Invalid JSON body.");
    }

    const existing = await prisma.contact.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return jsonError("Contact not found.", 404);
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        firstName: body.firstName ?? existing.firstName,
        lastName: body.lastName ?? existing.lastName,
        title: body.title !== undefined ? body.title : existing.title,
        email: body.email !== undefined ? body.email : existing.email,
        phone: body.phone !== undefined ? body.phone : existing.phone,
        mobilePhone: body.mobilePhone !== undefined ? body.mobilePhone : existing.mobilePhone,
        preferredContactMethod: body.preferredContactMethod !== undefined
          ? (body.preferredContactMethod as any)
          : existing.preferredContactMethod,
        isDecisionMaker: body.isDecisionMaker ?? existing.isDecisionMaker,
        isTechnicalInfluencer: body.isTechnicalInfluencer ?? existing.isTechnicalInfluencer,
        isGatekeeper: body.isGatekeeper ?? existing.isGatekeeper,
        isPrimary: body.isPrimary ?? existing.isPrimary,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        status: body.status !== undefined ? (body.status as any) : existing.status,
      },
      include: {
        customer: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({ data: contact });
  } catch (err) {
    console.error("PUT /api/contacts/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

/**
 * DELETE /api/contacts/[id]
 * Delete a contact
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  try {
    const existing = await prisma.contact.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return jsonError("Contact not found.", 404);
    }

    await prisma.contact.delete({ where: { id } });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error("DELETE /api/contacts/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
