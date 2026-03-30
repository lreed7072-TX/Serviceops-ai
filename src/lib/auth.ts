import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

const isDevLocal =
  process.env.NODE_ENV === "development" &&
  process.env.DEV_AUTH_BYPASS === "true";

// Fail fast if anyone ever sets dev-auth vars outside local development
if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
  const hasDevStuff =
    process.env.DEV_AUTH_BYPASS === "true" ||
    !!process.env.DEV_ORG_ID ||
    !!process.env.DEV_USER_ID ||
    !!process.env.DEV_ROLE;

  if (hasDevStuff) {
    throw new Error(
      "SECURITY: Dev auth env vars must not be set outside local development."
    );
  }
}

export type AuthContext = {
  orgId: string;
  userId: string;
  role: Role;
};

/**
 * Dev-only fallback auth using server-side env vars.
 * ONLY active when NODE_ENV=development AND DEV_AUTH_BYPASS=true.
 * Never reads NEXT_PUBLIC_ vars (those should not exist).
 */
function getDevEnvAuth(): AuthContext | null {
  if (!isDevLocal) return null;

  const orgId = process.env.DEV_ORG_ID ?? null;
  const userId = process.env.DEV_USER_ID ?? null;
  const role = process.env.DEV_ROLE ?? null;

  if (!orgId || !userId || !role) return null;
  if (!Object.values(Role).includes(role as Role)) return null;

  return { orgId, userId, role: role as Role };
}

/**
 * Legacy header-based auth context.
 * RESTRICTED: Only available in local development with DEV_AUTH_BYPASS=true.
 * In all other environments, this returns null — use Supabase session auth.
 */
export function getAuthContext(request: Request): AuthContext | null {
  // Only allow header-based auth in local development
  if (!isDevLocal) return null;

  const orgId = request.headers.get("x-org-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-role");

  if (orgId && userId && role) {
    if (!Object.values(Role).includes(role as Role)) return null;
    return { orgId, userId, role: role as Role };
  }

  // Fall back to env-based dev auth
  return getDevEnvAuth();
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
import { cache } from "react";


/**
 * Look up the user's org/role from the DB. Wrapped with React cache() so
 * multiple calls within the same server request lifecycle are deduplicated.
 */
const getOrgRole = cache(async (userId: string): Promise<AuthContext | null> => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT org_id::text as org_id, role as role
     FROM user_org_roles
     WHERE user_id = $1::uuid
     LIMIT 1`,
    userId
  );

  const row = (rows as any[])[0];
  if (!row?.org_id || !row?.role) return null;

  return { orgId: row.org_id, userId, role: row.role as Role };
});

/**
 * Resolve auth context from Supabase session cookie + DB mapping (user_org_roles).
 * Falls back to existing header/dev logic elsewhere (keep current behavior).
 *
 * The DB lookup is deduplicated per-request via React cache(), so calling this
 * multiple times in the same render tree (layout + page) only hits the DB once.
 */
export async function getAuthContextFromSupabase(
  request?: Request
): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();

  // Try cookie-based auth first
  let { data, error } = await supabase.auth.getUser();

  // If cookie auth fails, try Bearer token from Authorization header
  if ((error || !data?.user) && request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const result = await supabase.auth.getUser(token);
      data = result.data;
      error = result.error;
    }
  }

  if (error || !data?.user) return null;

  return getOrgRole(data.user.id);
}

/**
 * Require auth using Supabase session cookie first, then fall back to header/dev env auth.
 * Intended for migrating endpoints one-by-one off header auth without breaking Preview/dev.
 */
export async function requireAuthSessionFirst(
  request: Request
): Promise<{ auth: AuthContext } | { error: NextResponse }> {
  const auth = (await getAuthContextFromSupabase(request)) ?? getAuthContext(request);

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

