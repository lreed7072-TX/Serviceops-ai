import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export type AuthContext = {
  orgId: string;
  userId: string;
  role: Role;
};

export function getAuthContext(request: Request): AuthContext | null {
  const orgId = request.headers.get("x-org-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-role");

  if (!orgId || !userId || !role) {
    return null;
  }

  if (!Object.values(Role).includes(role as Role)) {
    return null;
  }

  return { orgId, userId, role: role as Role };
}

export function requireAuth(request: Request):
  | { auth: AuthContext }
  | { error: NextResponse } {
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
    return NextResponse.json(
      { error: "Insufficient permissions." },
      { status: 403 }
    );
  }

  return null;
}
