// Portal Authentication API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";

export const runtime = "nodejs";

/**
 * POST /api/portal/auth
 * Validate portal token and set cookie
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return jsonError("Token is required.", 400);
    }

    const portalToken = await prisma.customerPortalToken.findUnique({
      where: { token },
      include: {
        customer: {
          select: { id: true, name: true, primaryEmail: true },
        },
        org: {
          select: { id: true, name: true, logoUrl: true },
        },
      },
    });

    if (!portalToken) {
      return jsonError("Invalid portal token.", 401);
    }

    if (!portalToken.isActive) {
      return jsonError("Portal access has been revoked.", 403);
    }

    if (portalToken.expiresAt && new Date(portalToken.expiresAt) < new Date()) {
      return jsonError("Portal access has expired.", 403);
    }

    // Update lastUsedAt
    await prisma.customerPortalToken.update({
      where: { id: portalToken.id },
      data: { lastUsedAt: new Date() },
    });

    // Set cookie and return customer info
    const response = NextResponse.json({
      data: {
        customer: portalToken.customer,
        org: portalToken.org,
      },
    });

    response.cookies.set("portal_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error) {
    console.error("Portal auth error:", error);
    return jsonError("Authentication failed", 500);
  }
}
