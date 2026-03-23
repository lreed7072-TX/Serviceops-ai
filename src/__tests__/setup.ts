import { vi } from "vitest";

// Default test auth context - individual tests can override via mockResolvedValueOnce
const defaultAuth = { orgId: "org-1", userId: "user-1", role: "ADMIN" as const };

// Mock the auth module to return test auth context by default.
// Tests for unauthenticated scenarios should use mockResolvedValueOnce to override.
vi.mock("@/lib/auth", () => ({
  requireAuthSessionFirst: vi.fn().mockResolvedValue({ auth: defaultAuth }),
  requireAuth: vi.fn().mockReturnValue({ auth: defaultAuth }),
  getAuthContext: vi.fn().mockReturnValue(defaultAuth),
  getAuthContextFromSupabase: vi.fn().mockResolvedValue(defaultAuth),
  requireRole: vi.fn().mockReturnValue(null), // null = role check passes
}));

// Mock Prisma client globally
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({}),
    },
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    site: {
      findFirst: vi.fn(),
    },
    asset: {
      findFirst: vi.fn(),
    },
    quote: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    quoteLineItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    workPackage: {
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    customFieldDefinition: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    customFieldValue: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    industry: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    leadSource: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    callType: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    callOutcome: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    followUpType: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: new Error("No session"),
      }),
    },
  }),
}));
