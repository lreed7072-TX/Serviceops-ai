import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, OpportunityStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/opportunities
 * List opportunities with pagination and filters.
 * ADMIN sees all. SALES sees own only. DISPATCHER read-only (sees all). TECH returns 403.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // TECH cannot access opportunities
    if (auth.role === Role.TECH) {
      return jsonError("Insufficient permissions.", 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as OpportunityStatus | null;
    const customerId = searchParams.get("customerId");
    const createdByUserId = searchParams.get("createdByUserId");
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    // Build where clause
    const where: any = {
      orgId: auth.orgId,
    };

    // SALES role: only see own opportunities
    if (auth.role === Role.SALES) {
      where.createdByUserId = auth.userId;
    }

    // Filter by status
    if (status && Object.values(OpportunityStatus).includes(status)) {
      where.status = status;
    }

    // Filter by customer
    if (customerId) {
      where.customerId = customerId;
    }

    // Filter by creator (only effective for ADMIN/DISPATCHER)
    if (createdByUserId && auth.role !== Role.SALES) {
      where.createdByUserId = createdByUserId;
    }

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          convertedQuote: { select: { id: true, quoteNumber: true, status: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.opportunity.count({ where }),
    ]);

    return NextResponse.json({ data: opportunities, total, limit, offset });
  } catch (error) {
    console.error("Failed to fetch opportunities:", error);
    return jsonError("Failed to fetch opportunities", 500);
  }
}

/**
 * POST /api/opportunities
 * Create a new opportunity. SALES + ADMIN can create.
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // Only SALES and ADMIN can create
    const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
    if (roleError) return roleError;

    const body = await parseJson<any>(request);
    if (!body) {
      return jsonError("Invalid JSON body.", 400);
    }

    const {
      customerId,
      name,
      callLogId,
      siteId,
      contactId,
      description,
      amount,
      status,
      expectedCloseDate,
      notes,
    } = body;

    // Validate required fields
    if (!customerId || !name) {
      return jsonError("customerId and name are required.", 400);
    }

    // Verify customer belongs to org
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, orgId: auth.orgId },
    });

    if (!customer) {
      return jsonError("Customer not found.", 404);
    }

    // Validate status if provided
    if (status && !Object.values(OpportunityStatus).includes(status)) {
      return jsonError("Invalid opportunity status.", 400);
    }

    const opportunity = await prisma.opportunity.create({
      data: {
        orgId: auth.orgId,
        customerId,
        name,
        createdByUserId: auth.userId,
        callLogId: callLogId || null,
        siteId: siteId || null,
        contactId: contactId || null,
        description: description || null,
        amount: amount != null ? amount : null,
        status: status || OpportunityStatus.PROSPECTING,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes: notes || null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: opportunity }, { status: 201 });
  } catch (error) {
    console.error("Failed to create opportunity:", error);
    return jsonError("Failed to create opportunity", 500);
  }
}
