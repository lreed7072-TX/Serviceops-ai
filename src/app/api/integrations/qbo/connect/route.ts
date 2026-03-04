import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { getAuthorizationUrl } from "@/lib/qbo/qbo-client";

// GET /api/integrations/qbo/connect
// Redirects the user to the Intuit OAuth authorization screen
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;

  const redirectUri = process.env.QBO_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json(
      { error: "QBO_REDIRECT_URI not configured" },
      { status: 500 }
    );
  }

  try {
    const url = getAuthorizationUrl(authResult.auth.orgId, redirectUri);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate auth URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
