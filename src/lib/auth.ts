import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

const isProd = process.env.VERCEL_ENV === "production";

// Fail fast if anyone ever sets dev-auth vars in Production
if (isProd) {
  const hasDevStuff =
    process.env.DEV_AUTH_BYPASS === "true" ||
    !!process.env.DEV_ORG_ID ||
    !!process.env.DEV_USER_ID ||
    !!process.env.DEV_ROLE;

  if (hasDevStuff) {
    throw new Error("SECURITY: Dev auth env vars must not be set in Production.");
  }
}

export type AuthContext = {
  orgId: string;
  userId: string;
  role: Role;
};

function getDevEnvAuth() {
  const orgId = process.env.DEV_ORG_ID ?? process.env.NEXT_PUBLIC_DEV_ORG_ID ?? null;
  const userId = process.env.DEV_USER_ID ?? process.env.NEXT_PUBLIC_DEV_USER_ID ?? null;
  const role = process.env.DEV_ROLE ?? process.env.NEXT_PUBLIC_DEV_ROLE ?? null;
  return { orgId, userId, role };
}

const isVercelProduction = process.env.VERCEL_ENV === "production";

export function getAuthContext(request: Request): AuthContext | null {
  let orgId = request.headers.get("x-org-id");
  let userId = request.headers.get("x-user-id");
  let role = request.headers.get("x-role");

  // Preview/dev fallback: if env IDs exist and we're NOT Vercel production, use them.
  if ((!orgId || !userId || !role) && !isVercelProduction) {
    const envAuth = getDevEnvAuth();
    if (envAuth.orgId && envAuth.userId && envAuth.role) {
      orgId = orgId ?? envAuth.orgId;
      userId = userId ?? envAuth.userId;
      role = role ?? envAuth.role;
    }
  }

  if (!orgId || !userId || !role) return null;
  if (!Object.values(Role).includes(role as Role)) return null;

  return { orgId, userId, role: role as Role };
}

export function requireAuth(
  request: Request
): { auth: AuthContext } | { error: NextResponse } {
  const auth = getAuthContext(request);

  if (!auth) {
    return {
      error: NextResponse.json(
        { error: "Missing or invalid auth headers." },
        { status: 401 }
      ),
    };
  }

  return { auth };
}

export function requireRole(auth: AuthContext, allowed: Role[]): NextResponse | null {
  if (!allowed.includes(auth.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }
  return null;
}

// SUPABASE_SESSION_AUTH
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";


export type AuthContext = { orgId: string; userId: string; role: Role };

/**
 * Resolve auth context from Supabase session cookie + DB mapping (user_org_roles).
 * Falls back to existing header/dev logic elsewhere (keep current behavior).
 */
export async function getAuthContextFromSupabase(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;

  const userId = data.user.id;

  // NOTE: This uses raw SQL so we don't need a Prisma model immediately.
  const rows = await prisma.$queryRawUnsafe(
    `SELECT org_id::text as org_id, role as role
     FROM user_org_roles
     WHERE user_id = $1
     LIMIT 1`,
    userId
  );

  const row = (rows as any[])[0];
  if (!row?.org_id || !row?.role) return null;

  return { orgId: row.org_id, userId, role: row.role as Role };
}
