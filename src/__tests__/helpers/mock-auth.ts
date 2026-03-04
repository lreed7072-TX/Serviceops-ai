import { vi } from "vitest";
import { NextResponse } from "next/server";
import type { AuthContext } from "@/lib/auth";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";

const mockedAuth = vi.mocked(requireAuthSessionFirst);
const mockedRole = vi.mocked(requireRole);

/**
 * Create a simple Request for testing API routes.
 */
export function createAuthenticatedRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    orgId?: string;
    userId?: string;
    role?: string;
  } = {}
): Request {
  const { method = "GET", body } = options;
  const headers: Record<string, string> = {};

  if (body) {
    headers["content-type"] = "application/json";
  }

  return new Request(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * Create a Request and mock auth to return 401 for this call.
 */
export function createUnauthenticatedRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Request {
  // Override the auth mock for the next call to return 401
  mockedAuth.mockResolvedValueOnce({
    error: NextResponse.json(
      { error: "Missing or invalid auth headers." },
      { status: 401 }
    ),
  });

  const { method = "GET", body } = options;
  const headers: Record<string, string> = {};

  if (body) {
    headers["content-type"] = "application/json";
  }

  return new Request(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * Mock auth to return a specific role, then mock requireRole to reject it.
 */
export function mockForbiddenRole(role: string = "TECH") {
  mockedAuth.mockResolvedValueOnce({
    auth: { orgId: "org-1", userId: "user-forbidden", role: role as any },
  });
  mockedRole.mockReturnValueOnce(
    NextResponse.json({ error: "Insufficient permissions." }, { status: 403 })
  );
}

/**
 * Standard test auth contexts.
 */
export const TEST_AUTH: Record<string, AuthContext> = {
  admin: { orgId: "org-1", userId: "user-1", role: "ADMIN" },
  dispatcher: { orgId: "org-1", userId: "user-2", role: "DISPATCHER" },
  tech: { orgId: "org-1", userId: "user-3", role: "TECH" },
  otherOrgAdmin: { orgId: "org-other", userId: "user-other", role: "ADMIN" },
};
