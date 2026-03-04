import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type PortalContext = {
  orgId: string;
  customerId: string;
  customerName: string;
};

/**
 * Validate portal token and return portal context.
 * Checks cookie 'portal_token' or query param 'token'.
 * Updates lastUsedAt on each valid use.
 */
export async function requirePortalAuth(request: Request): Promise<{
  error?: NextResponse;
  portal?: PortalContext;
}> {
  // Extract token from cookie or query param
  let token: string | null = null;

  // Check query param first
  const url = new URL(request.url);
  token = url.searchParams.get("token");

  // Check cookie if no query param
  if (!token) {
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith("portal_token=")) {
        token = cookie.substring("portal_token=".length);
        break;
      }
    }
  }

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Portal authentication required." },
        { status: 401 }
      ),
    };
  }

  // Validate token against database
  const portalToken = await prisma.customerPortalToken.findUnique({
    where: { token },
    include: {
      customer: {
        select: { id: true, name: true },
      },
    },
  });

  if (!portalToken) {
    return {
      error: NextResponse.json(
        { error: "Invalid portal token." },
        { status: 401 }
      ),
    };
  }

  // Check if active
  if (!portalToken.isActive) {
    return {
      error: NextResponse.json(
        { error: "Portal access has been revoked." },
        { status: 403 }
      ),
    };
  }

  // Check expiry
  if (portalToken.expiresAt && new Date(portalToken.expiresAt) < new Date()) {
    return {
      error: NextResponse.json(
        { error: "Portal access has expired." },
        { status: 403 }
      ),
    };
  }

  // Update lastUsedAt (fire and forget)
  prisma.customerPortalToken
    .update({
      where: { id: portalToken.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    portal: {
      orgId: portalToken.orgId,
      customerId: portalToken.customerId,
      customerName: portalToken.customer.name,
    },
  };
}
