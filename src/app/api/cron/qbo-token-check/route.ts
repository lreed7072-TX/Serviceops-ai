import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/qbo/qbo-client";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ orgId: string; orgName: string; action: string; success: boolean; error?: string }> = [];

  try {
    // Fetch all active connections with org info
    const connections = await prisma.qboConnection.findMany({
      where: { isActive: true },
      include: { org: { select: { id: true, name: true } } },
    });

    for (const conn of connections) {
      const orgName = conn.org?.name || "Unknown Org";
      const orgId = conn.orgId;

      try {
        // Check if refresh token is expiring within 14 days
        const daysUntilExpiry = conn.refreshTokenExpiry
          ? Math.floor((conn.refreshTokenExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : null;

        if (daysUntilExpiry === null) {
          // No expiry date set — skip but log
          results.push({ orgId, orgName, action: "skipped", success: true });
          continue;
        }

        if (daysUntilExpiry > 14) {
          // Token not expiring soon — no action needed
          results.push({ orgId, orgName, action: "healthy", success: true });
          continue;
        }

        // Proactive refresh
        console.log(`[Token Check] Org ${orgName}: token expires in ${daysUntilExpiry} days — refreshing`);

        const tokens = await refreshAccessToken(conn);

        // Update connection with new tokens
        await prisma.qboConnection.update({
          where: { id: conn.id },
          data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
            refreshTokenExpiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000), // 100 days
          },
        });

        // Log success
        await prisma.qboSyncLog.create({
          data: {
            orgId,
            connectionId: conn.id,
            entityType: "tokenRefresh",
            entityId: conn.id,
            action: "refresh",
            status: "success",
          },
        });

        results.push({ orgId, orgName, action: "refreshed", success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isInvalidGrant = errorMessage.includes("invalid_grant");

        console.error(`[Token Check] Org ${orgName}: refresh failed — ${errorMessage}`);

        if (isInvalidGrant) {
          // Mark connection inactive
          await prisma.qboConnection.update({
            where: { id: conn.id },
            data: { isActive: false },
          });

          // Send admin alert email
          try {
            const admins = await prisma.user.findMany({
              where: { orgId, role: "ADMIN" },
              select: { email: true, name: true },
            });

            const reconnectUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://serviceops-ai.vercel.app"}/settings/integrations?reconnect=true`;

            for (const admin of admins) {
              await sendEmail({
                to: admin.email,
                subject: `[ServiceOps] QBO Connection Lost — ${conn.companyName || orgName}`,
                html: `
                  <div style="font-family: 'Space Grotesk', sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ef4444;">QuickBooks Online Connection Lost</h2>
                    <p>The QBO connection for <strong>${conn.companyName || orgName}</strong> has expired and could not be refreshed automatically.</p>
                    <p><strong>Company:</strong> ${conn.companyName || "N/A"}</p>
                    <p><strong>Token Expiry:</strong> ${conn.refreshTokenExpiry?.toLocaleDateString() || "Unknown"}</p>
                    <p style="margin-top: 20px;">
                      <a href="${reconnectUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                        Reconnect QuickBooks
                      </a>
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                      Until reconnected, no data will sync between ServiceOps and QuickBooks.
                    </p>
                  </div>
                `,
              });
            }
          } catch (emailErr) {
            console.error(`[Token Check] Failed to send admin email for ${orgName}:`, emailErr);
          }
        }

        // Log failure
        await prisma.qboSyncLog.create({
          data: {
            orgId,
            connectionId: conn.id,
            entityType: "tokenRefresh",
            entityId: conn.id,
            action: "refresh",
            status: "failed",
            errorMessage,
          },
        });

        results.push({ orgId, orgName, action: isInvalidGrant ? "deactivated" : "failed", success: false, error: errorMessage });
      }
    }

    return NextResponse.json({
      processed: connections.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Token Check] Cron failed:", err);
    return NextResponse.json(
      { error: "Token check cron failed", details: String(err) },
      { status: 500 }
    );
  }
}
