import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Never expose in production
  if (process.env.VERCEL_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const report = {
    vercelEnv: process.env.VERCEL_ENV ?? null,
    devAuthBypass: process.env.DEV_AUTH_BYPASS === "true",
    hasDevOrgId: !!process.env.DEV_ORG_ID,
    hasDevUserId: !!process.env.DEV_USER_ID,
    hasDevRole: !!process.env.DEV_ROLE,
    headerOrg: !!req.headers.get("x-org-id"),
    headerUser: !!req.headers.get("x-user-id"),
    headerRole: !!req.headers.get("x-role"),
  };

  return NextResponse.json(report);
}
