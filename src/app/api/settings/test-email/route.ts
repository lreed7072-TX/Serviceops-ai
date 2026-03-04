import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/settings/test-email
 * Send a test email to verify configuration
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN"]);
    if (roleCheck) return roleCheck;

    const org = await prisma.org.findUnique({
      where: { id: auth.orgId },
      select: {
        name: true,
        emailFromName: true,
        emailFromAddress: true,
        emailReplyTo: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Look up the current user's email to restrict test emails to self only
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });

    if (!user?.email) {
      return NextResponse.json(
        { error: "Could not determine your email address" },
        { status: 400 }
      );
    }

    const to = user.email;

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    await sendEmail({
      to,
      subject: `Test Email from ${org.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Configuration Test</h2>
          <p>This is a test email from ServiceOpsIQ to verify your email configuration.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Organization:</strong> ${esc(org.name)}</p>
            <p style="margin: 8px 0 0 0;"><strong>From:</strong> ${esc(org.emailFromName || org.name)} &lt;${esc(org.emailFromAddress || "noreply@serviceopsiq.com")}&gt;</p>
            ${org.emailReplyTo ? `<p style="margin: 8px 0 0 0;"><strong>Reply-To:</strong> ${esc(org.emailReplyTo)}</p>` : ""}
          </div>
          <p>If you received this email, your email configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 13px; color: #6b7280;">
            Sent from ServiceOpsIQ
          </p>
        </div>
      `,
      fromName: org.emailFromName || org.name,
      fromEmail: org.emailFromAddress || undefined,
      replyTo: org.emailReplyTo || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${to}`,
    });
  } catch (error) {
    console.error("Send test email error:", error);
    return NextResponse.json(
      { error: "Failed to send test email. Check your Resend API key and email settings." },
      { status: 500 }
    );
  }
}
