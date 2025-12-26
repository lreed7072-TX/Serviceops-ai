import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export type AuthContext = {
  orgId: string;
  userId: string;
  role: Role;
};

const truthy = (value?: string | null): boolean =>
  typeof value === "string" && value.toLowerCase() === "true";

// Allow env-based dev auth ONLY when explicitly enabled AND not Vercel production.
const devBypassEnabled =
  truthy(process.env.DEV_AUTH_BYPASS ?? process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS ?? "") &&
  process.env.VERCEL_ENV !== "production";

function getDevEnvAuth(): { orgId: string | null; userId: string | null; role: string | null } {
  const orgId = process.env.DEV_ORG_ID ?? process.env.NEXT_PUBLIC_DEV_ORG_ID ?? null;
  const userId = process.env.DEV_USER_ID ?? process.env.NEXT_PUBLIC_DEV_USER_ID ?? null;
  const role = process.env.DEV_ROLE ?? process.env.NEXT_PUBLIC_DEV_ROLE ?? null;
  return { orgId, userId, role };
}

export function getAuthContext(request: Request): AuthContext | null {
  let orgId = request.headers.get("x-org-id");
  let userId = request.headers.get("x-user-id");
  let role = request.headers.get("x-role");

  // If headers are missing, fall back to env session in Preview/dev bypass mode.
  if ((!orgId || !userId || !role) && devBypassEnabled) {
    const envAuth = getDevEnvAuth();
    orgId = orgId ?? envAuth.orgId;
    userId = userId ?? envAuth.userId;
    role = role ?? envAuth.role;
  }

  if (!orgId || !userId || !role) {
    return null;
  }

  if (!Object.values(Role).includes(role as Role)) {
    return null;
  }

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
