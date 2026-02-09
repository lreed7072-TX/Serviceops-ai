import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/validate-invite?token=xxx
 * Validate an invitation token (no auth required)
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing invitation token" },
        { status: 400 }
      );
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        org: { select: { name: true } },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 404 }
      );
    }

    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Find the pre-created user record (created during invite)
    const user = await prisma.user.findFirst({
      where: { orgId: invite.orgId, email: invite.email },
      select: { name: true },
    });

    return NextResponse.json({
      data: {
        email: invite.email,
        name: user?.name || "",
        role: invite.role,
        orgName: invite.org.name,
      },
    });
  } catch (error) {
    console.error("Validate invite error:", error);
    return NextResponse.json(
      { error: "Failed to validate invitation" },
      { status: 500 }
    );
  }
}
