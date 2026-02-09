import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";

/**
 * POST /api/users/invite
 * Invite a new user to the organization via the Invite model
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN"]);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const { email, name, role } = body;

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: "Email, name, and role are required" },
        { status: 400 }
      );
    }

    if (!["ADMIN", "DISPATCHER", "TECH"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists in this org
    const existingUser = await prisma.user.findUnique({
      where: { orgId_email: { orgId: auth.orgId, email: normalizedEmail } },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists in your organization" },
        { status: 400 }
      );
    }

    // Check for pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        orgId: auth.orgId,
        email: normalizedEmail,
        status: "PENDING",
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email" },
        { status: 400 }
      );
    }

    // Get organization for email
    const org = await prisma.org.findUnique({
      where: { id: auth.orgId },
      select: { name: true, emailFromName: true, emailFromAddress: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Generate invitation token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite record
    const invite = await prisma.invite.create({
      data: {
        orgId: auth.orgId,
        email: normalizedEmail,
        role,
        token,
        status: "PENDING",
        expiresAt,
        invitedById: auth.userId,
      },
    });

    // Also create the User record (inactive until they sign up)
    await prisma.user.create({
      data: {
        orgId: auth.orgId,
        email: normalizedEmail,
        name: name.trim(),
        role,
        isActive: false,
      },
    });

    // Send invitation email
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://serviceopsiq.com"}/accept-invite?token=${token}`;

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: `You're invited to join ${org.name} on ServiceOpsIQ`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ServiceOpsIQ!</h2>
            <p>Hi ${name},</p>
            <p>You've been invited to join <strong>${org.name}</strong> as a <strong>${role}</strong>.</p>

            <div style="margin: 32px 0;">
              <a href="${inviteUrl}" style="
                display: inline-block;
                padding: 14px 28px;
                background: #3b82f6;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
              ">Accept Invitation</a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              This invitation expires in 7 days.
            </p>
          </div>
        `,
        fromName: org.emailFromName || org.name,
        fromEmail: org.emailFromAddress || undefined,
      });
    } catch (emailErr) {
      console.error("Failed to send invite email:", emailErr);
      // Invite record created even if email fails
    }

    return NextResponse.json({
      data: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
      },
      message: `Invitation sent to ${normalizedEmail}`,
    });
  } catch (error) {
    console.error("Invite user error:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}
