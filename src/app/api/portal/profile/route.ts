// Portal Profile API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requirePortalAuth } from "@/lib/portal-auth";

export const runtime = "nodejs";

/**
 * GET /api/portal/profile
 * Return customer profile info
 */
export async function GET(request: Request) {
  try {
    const authResult = await requirePortalAuth(request);
    if (authResult.error) return authResult.error;
    const { portal } = authResult;

    const customer = await prisma.customer.findFirst({
      where: {
        id: portal!.customerId,
        orgId: portal!.orgId,
      },
      select: {
        id: true,
        name: true,
        primaryEmail: true,
        primaryPhone: true,
        billingStreet1: true,
        billingStreet2: true,
        billingCity: true,
        billingState: true,
        billingPostalCode: true,
        billingCountry: true,
      },
    });

    if (!customer) {
      return jsonError("Customer not found.", 404);
    }

    // Also get org info for branding
    const org = await prisma.org.findUnique({
      where: { id: portal!.orgId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        contactEmail: true,
        contactPhone: true,
      },
    });

    return NextResponse.json({
      data: {
        customer,
        org,
      },
    });
  } catch (error) {
    console.error("Portal profile error:", error);
    return jsonError("Failed to fetch profile", 500);
  }
}
