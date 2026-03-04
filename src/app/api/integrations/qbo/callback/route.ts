import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, getCompanyInfo } from "@/lib/qbo/qbo-client";

// GET /api/integrations/qbo/callback
// Handles the OAuth callback from Intuit
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state"); // orgId passed through OAuth state
  const error = searchParams.get("error");

  // Handle OAuth errors (user denied access, etc.)
  if (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?qbo_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !realmId || !state) {
    return NextResponse.json(
      { error: "Missing required OAuth parameters (code, realmId, state)" },
      { status: 400 }
    );
  }

  const orgId = state;

  // Verify the org exists
  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) {
    return NextResponse.json({ error: "Invalid organization" }, { status: 400 });
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, realmId);

    // Upsert the connection (one per org)
    const connection = await prisma.qboConnection.upsert({
      where: { orgId },
      create: {
        orgId,
        realmId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        isActive: true,
      },
      update: {
        realmId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        isActive: true,
        connectedAt: new Date(),
      },
    });

    // Fetch company name from QBO
    try {
      const companyInfo = await getCompanyInfo(connection);
      await prisma.qboConnection.update({
        where: { id: connection.id },
        data: { companyName: companyInfo.companyName },
      });
    } catch {
      // Non-fatal: company name is nice-to-have
    }

    // Redirect back to settings page with success
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return NextResponse.redirect(`${appUrl}/settings/integrations?qbo_connected=true`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?qbo_error=${encodeURIComponent(message)}`
    );
  }
}
