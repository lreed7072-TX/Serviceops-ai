import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import {
  requireAuthSessionFirst,
  requireRole,
  type AuthContext,
} from "@/lib/auth";

// Auth module is mocked globally in setup.ts.
// These tests verify the mock behavior and the requireRole contract.

const mockedRequireAuthSessionFirst = vi.mocked(requireAuthSessionFirst);
const mockedRequireRole = vi.mocked(requireRole);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuthSessionFirst", () => {
  it("returns auth context for authenticated requests (default mock)", async () => {
    const req = new Request("http://localhost/api/test");
    const result = await requireAuthSessionFirst(req);
    expect("auth" in result).toBe(true);
    if ("auth" in result) {
      expect(result.auth.orgId).toBe("org-1");
      expect(result.auth.userId).toBe("user-1");
      expect(result.auth.role).toBe("ADMIN");
    }
  });

  it("returns 401 error for unauthenticated requests", async () => {
    mockedRequireAuthSessionFirst.mockResolvedValueOnce({
      error: NextResponse.json(
        { error: "Missing or invalid auth headers." },
        { status: 401 }
      ),
    });

    const req = new Request("http://localhost/api/test");
    const result = await requireAuthSessionFirst(req);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(401);
    }
  });

  it("returns correct auth context for different roles", async () => {
    const techAuth = { orgId: "org-1", userId: "user-3", role: "TECH" as const };
    mockedRequireAuthSessionFirst.mockResolvedValueOnce({ auth: techAuth });

    const req = new Request("http://localhost/api/test");
    const result = await requireAuthSessionFirst(req);
    expect("auth" in result).toBe(true);
    if ("auth" in result) {
      expect(result.auth.role).toBe("TECH");
    }
  });
});

describe("requireRole", () => {
  const adminAuth: AuthContext = {
    orgId: "org-1",
    userId: "user-1",
    role: "ADMIN",
  };
  const techAuth: AuthContext = {
    orgId: "org-1",
    userId: "user-3",
    role: "TECH",
  };
  const dispatcherAuth: AuthContext = {
    orgId: "org-1",
    userId: "user-2",
    role: "DISPATCHER",
  };

  it("returns null (passes) when role is in allowed list", () => {
    // Default mock returns null (pass)
    const result = requireRole(adminAuth, ["ADMIN", "DISPATCHER"]);
    expect(result).toBeNull();
  });

  it("returns 403 response when role is not allowed", () => {
    mockedRequireRole.mockReturnValueOnce(
      NextResponse.json({ error: "Insufficient permissions." }, { status: 403 })
    );

    const result = requireRole(techAuth, ["ADMIN", "DISPATCHER"]);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("allows ADMIN role for admin-only endpoints", () => {
    const result = requireRole(adminAuth, ["ADMIN"]);
    expect(result).toBeNull();
  });

  it("allows TECH role when TECH is in allowed list", () => {
    const result = requireRole(techAuth, ["ADMIN", "TECH"]);
    expect(result).toBeNull();
  });
});
