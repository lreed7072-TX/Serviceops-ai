import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type ContactCreatePayload = {
  customerId: string;
  firstName: string;
  lastName: string;
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

/**
 * GET /api/contacts
 * List contacts with pagination, search, and customerId filter
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER, Role.SALES]);
  if (roleError) return roleError;

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const search = searchParams.get("search") || "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const where: any = {
      orgId: auth.orgId,
      ...(customerId && { customerId }),
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          customer: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({ data: contacts, total, limit, offset });
  } catch (err) {
    console.error("GET /api/contacts failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

/**
 * POST /api/contacts
 * Create a new contact
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
  if (roleError) return roleError;

  try {
    const body = await parseJson<ContactCreatePayload>(request);
    if (!body?.customerId || !body?.firstName || !body?.lastName) {
      return jsonError("customerId, firstName, and lastName are required.", 400);
    }

    // Verify customer belongs to this org
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, orgId: auth.orgId },
    });

    if (!customer) {
      return jsonError("Customer not found.", 404);
    }

    const contact = await prisma.contact.create({
      data: {
        orgId: auth.orgId,
        customerId: body.customerId,
        firstName: body.firstName,
        lastName: body.lastName,
        title: body.title ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        mobilePhone: body.mobilePhone ?? null,
        preferredContactMethod: body.preferredContactMethod as any ?? undefined,
        isDecisionMaker: body.isDecisionMaker ?? false,
        isTechnicalInfluencer: body.isTechnicalInfluencer ?? false,
        isGatekeeper: body.isGatekeeper ?? false,
        isPrimary: body.isPrimary ?? false,
        notes: body.notes ?? null,
        status: body.status as any ?? undefined,
        createdByUserId: auth.userId,
      },
      include: {
        customer: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (err) {
    console.error("POST /api/contacts failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
