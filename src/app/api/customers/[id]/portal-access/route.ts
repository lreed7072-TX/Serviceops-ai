// Customer Portal Access Management API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/customers/:id/portal-access
 * Check if customer has portal access
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: customerId } = await params;
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const token = await prisma.customerPortalToken.findFirst({
      where: {
        orgId: auth.orgId,
        customerId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        token: true,
      },
    });

    return NextResponse.json({
      data: {
        hasAccess: !!token,
        portalToken: token,
      },
    });
  } catch (error) {
    console.error("Failed to check portal access:", error);
    return jsonError("Failed to check portal access", 500);
  }
}

/**
 * POST /api/customers/:id/portal-access
 * Generate portal access token for customer
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: customerId } = await params;
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
      return jsonError("Only administrators can manage portal access.", 403);
    }

    // Verify customer belongs to org
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, orgId: auth.orgId },
    });

    if (!customer) {
      return jsonError("Customer not found.", 404);
    }

    const body = await request.json().catch(() => ({}));
    const email = body.email || customer.primaryEmail;

    if (!email) {
      return jsonError("Email is required. Customer has no primary email.", 400);
    }

    // Deactivate any existing tokens for this customer
    await prisma.customerPortalToken.updateMany({
      where: {
        orgId: auth.orgId,
        customerId,
        isActive: true,
      },
      data: { isActive: false },
    });

    // Create new token
    const portalToken = await prisma.customerPortalToken.create({
      data: {
        orgId: auth.orgId,
        customerId,
        email,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    // Build portal URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const portalUrl = `${baseUrl}/portal/login?token=${portalToken.token}`;

    return NextResponse.json({
      data: {
        portalToken,
        portalUrl,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create portal access:", error);
    return jsonError("Failed to create portal access", 500);
  }
}

/**
 * DELETE /api/customers/:id/portal-access
 * Revoke portal access for customer
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: customerId } = await params;
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
      return jsonError("Only administrators can manage portal access.", 403);
    }

    await prisma.customerPortalToken.updateMany({
      where: {
        orgId: auth.orgId,
        customerId,
        isActive: true,
      },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Portal access revoked." });
  } catch (error) {
    console.error("Failed to revoke portal access:", error);
    return jsonError("Failed to revoke portal access", 500);
  }
}
