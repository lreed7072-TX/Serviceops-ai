import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, OpportunityStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/opportunities/[id]
 * Get a single opportunity by ID. SALES + ADMIN + DISPATCHER can read. TECH returns 403.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // TECH cannot access opportunities
    if (auth.role === Role.TECH) {
      return jsonError("Insufficient permissions.", 403);
    }

    const where: any = {
      id,
      orgId: auth.orgId,
    };

    // SALES can only see own opportunities
    if (auth.role === Role.SALES) {
      where.createdByUserId = auth.userId;
    }

    const opportunity = await prisma.opportunity.findFirst({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        convertedQuote: { select: { id: true, quoteNumber: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        callLog: true,
        site: true,
      },
    });

    if (!opportunity) {
      return jsonError("Opportunity not found.", 404);
    }

    return NextResponse.json({ data: opportunity });
  } catch (error) {
    console.error("Failed to fetch opportunity:", error);
    return jsonError("Failed to fetch opportunity", 500);
  }
}

/**
 * PUT /api/opportunities/[id]
 * Update an opportunity. SALES + ADMIN can update.
 * When status changes to WON or LOST, sets wonLostAt.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // Only SALES and ADMIN can update
    const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
    if (roleError) return roleError;

    const where: any = {
      id,
      orgId: auth.orgId,
    };

    // SALES can only update own opportunities
    if (auth.role === Role.SALES) {
      where.createdByUserId = auth.userId;
    }

    const existing = await prisma.opportunity.findFirst({ where });

    if (!existing) {
      return jsonError("Opportunity not found.", 404);
    }

    const body = await parseJson<any>(request);
    if (!body) {
      return jsonError("Invalid JSON body.", 400);
    }

    const {
      name,
      customerId,
      callLogId,
      siteId,
      contactId,
      description,
      amount,
      status,
      expectedCloseDate,
      wonLostReason,
      notes,
    } = body;

    // Validate status if provided
    if (status && !Object.values(OpportunityStatus).includes(status)) {
      return jsonError("Invalid opportunity status.", 400);
    }

    // Build update data
    const data: any = {};

    if (name !== undefined) data.name = name;
    if (customerId !== undefined) data.customerId = customerId;
    if (callLogId !== undefined) data.callLogId = callLogId || null;
    if (siteId !== undefined) data.siteId = siteId || null;
    if (contactId !== undefined) data.contactId = contactId || null;
    if (description !== undefined) data.description = description || null;
    if (amount !== undefined) data.amount = amount != null ? amount : null;
    if (expectedCloseDate !== undefined) {
      data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    }
    if (wonLostReason !== undefined) data.wonLostReason = wonLostReason || null;
    if (notes !== undefined) data.notes = notes || null;

    // Handle status change — set wonLostAt when transitioning to WON or LOST
    if (status !== undefined) {
      data.status = status;
      const isWonOrLost = status === OpportunityStatus.WON || status === OpportunityStatus.LOST;
      const wasNotWonOrLost =
        existing.status !== OpportunityStatus.WON && existing.status !== OpportunityStatus.LOST;

      if (isWonOrLost && wasNotWonOrLost) {
        data.wonLostAt = new Date();
      }
      // Clear wonLostAt if moving back from WON/LOST to an active status
      if (!isWonOrLost && !wasNotWonOrLost) {
        data.wonLostAt = null;
      }
    }

    const opportunity = await prisma.opportunity.update({
      where: { id },
      data,
      include: {
        customer: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        convertedQuote: { select: { id: true, quoteNumber: true, status: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Notify ADMIN when opportunity is won or lost
    if (body.status === OpportunityStatus.WON || body.status === OpportunityStatus.LOST) {
      try {
        const admins = await prisma.user.findMany({
          where: {
            orgId: auth.orgId,
            role: Role.ADMIN,
            id: { not: auth.userId },
          },
          select: { id: true },
        });

        if (admins.length > 0) {
          await prisma.notification.createMany({
            data: admins.map((u) => ({
              userId: u.id,
              orgId: auth.orgId,
              type: body.status === OpportunityStatus.WON ? "OPPORTUNITY_WON" : "OPPORTUNITY_LOST",
              title: `Opportunity ${body.status === OpportunityStatus.WON ? "Won" : "Lost"}`,
              message: `${opportunity.name} (${opportunity.customer?.name || "Unknown"})${opportunity.amount ? " — $" + Number(opportunity.amount).toLocaleString() : ""}`,
              actionUrl: `/sales/opportunities/${opportunity.id}`,
            })),
          });
        }
      } catch (notifError) {
        console.error("Failed to create opportunity notification:", notifError);
      }
    }

    return NextResponse.json({ data: opportunity });
  } catch (error) {
    console.error("Failed to update opportunity:", error);
    return jsonError("Failed to update opportunity", 500);
  }
}

/**
 * DELETE /api/opportunities/[id]
 * Delete an opportunity. ADMIN only.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // ADMIN only
    const roleError = requireRole(auth, [Role.ADMIN]);
    if (roleError) return roleError;

    const opportunity = await prisma.opportunity.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!opportunity) {
      return jsonError("Opportunity not found.", 404);
    }

    await prisma.opportunity.delete({ where: { id } });

    return NextResponse.json({ message: "Opportunity deleted." });
  } catch (error) {
    console.error("Failed to delete opportunity:", error);
    return jsonError("Failed to delete opportunity", 500);
  }
}
