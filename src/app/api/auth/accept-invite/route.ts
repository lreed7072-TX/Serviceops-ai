import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/accept-invite
 * Accept an invitation - activates the user record and marks invite as accepted.
 * Called after the user creates their Supabase auth account on the client.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Missing invitation token" },
        { status: 400 }
      );
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
    });

    if (!invite || invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Invalid or already used invitation" },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    // Activate the user and mark invite as accepted in a transaction
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { orgId: invite.orgId, email: invite.email },
        data: { isActive: true },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Invitation accepted successfully",
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
