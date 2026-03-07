# ServiceOpsIQ Testing Guide

## Overview
The ServiceOpsIQ codebase uses **Vitest** as the test framework with unit and integration tests for API routes, library utilities, and business logic. Tests are located in `src/__tests__/` with a corresponding structure to the source code.

---

## Test Framework

### Vitest Configuration
- **Test runner**: Vitest 4.0.18
- **Environment**: jsdom (for testing browser APIs)
- **Setup file**: `src/__tests__/setup.ts` (global mocks for auth, Prisma, Supabase)

**Configuration file**: `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## Test Structure & Organization

### Directory Layout
Tests are organized to mirror the source structure:

```
src/__tests__/
├── setup.ts                 # Global mocks (auth, Prisma, Supabase)
├── helpers/
│   ├── mock-auth.ts        # Auth mocking helpers
│   ├── mock-prisma.ts      # Prisma client mocking
│   └── test-data.ts        # Factory functions for test data
├── api/
│   ├── auth.test.ts        # Auth system tests
│   ├── work-orders.test.ts # Work order CRUD tests
│   ├── quotes.test.ts      # Quote tests
│   ├── invoices.test.ts    # Invoice tests
│   └── multi-tenant.test.ts # Multi-tenant isolation tests
└── lib/
    ├── audit.test.ts       # Audit logging tests
    └── utils.test.ts       # Utility function tests
```

### File Naming Convention
- **Test files**: `*.test.ts` (not `.spec.ts`)
- **Helpers**: Named descriptively, e.g., `mock-auth.ts`, `test-data.ts`

---

## Mocking Patterns

### Global Setup (`src/__tests__/setup.ts`)
All tests have access to mocked versions of:
- `@/lib/auth` (requireAuthSessionFirst, requireRole, getAuthContext)
- `@/lib/prisma` (prisma client with all models)
- `@/lib/supabase/server` (createSupabaseServerClient)

**Key principle**: Mocks are globally defined but can be overridden per-test via `.mockResolvedValueOnce()` or `.mockReturnValueOnce()`.

**From** `src/__tests__/setup.ts`:
```typescript
import { vi } from "vitest";

// Mock auth module
vi.mock("@/lib/auth", () => ({
  requireAuthSessionFirst: vi.fn().mockResolvedValue({
    auth: defaultAuth // Default authenticated user
  }),
  requireRole: vi.fn().mockReturnValue(null), // null = role check passes
  getAuthContext: vi.fn().mockReturnValue(defaultAuth),
  getAuthContextFromSupabase: vi.fn().mockResolvedValue(defaultAuth),
}));

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    // ... other models
  },
}));

// Mock Supabase
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
```

### Auth Mocking Helpers (`src/__tests__/helpers/mock-auth.ts`)

#### Function: `createAuthenticatedRequest()`
Creates a Request object with default authenticated context (org-1, user-1, ADMIN role).

```typescript
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
  // Returns Request with mocked auth
}
```

**Usage**:
```typescript
const req = createAuthenticatedRequest("http://localhost/api/work-orders");
const res = await GET(req);
expect(res.status).toBe(200);
```

#### Function: `createUnauthenticatedRequest()`
Creates a Request and mocks auth to return 401 error for that call.

```typescript
export function createUnauthenticatedRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Request {
  mockedAuth.mockResolvedValueOnce({
    error: NextResponse.json(
      { error: "Missing or invalid auth headers." },
      { status: 401 }
    ),
  });
  // Returns Request
}
```

**Usage**:
```typescript
const req = createUnauthenticatedRequest("http://localhost/api/work-orders");
const res = await GET(req);
expect(res.status).toBe(401);
```

#### Function: `mockForbiddenRole()`
Mocks auth context with a specific role and mocks `requireRole()` to reject it (403).

```typescript
export function mockForbiddenRole(role: string = "TECH") {
  mockedAuth.mockResolvedValueOnce({
    auth: { orgId: "org-1", userId: "user-forbidden", role: role as any },
  });
  mockedRole.mockReturnValueOnce(
    NextResponse.json({ error: "Insufficient permissions." }, { status: 403 })
  );
}
```

**Usage**:
```typescript
mockForbiddenRole("TECH");
const req = createAuthenticatedRequest(...);
const res = await POST(req);
expect(res.status).toBe(403);
```

#### Constant: `TEST_AUTH`
Pre-built auth contexts for common test scenarios.

```typescript
export const TEST_AUTH = {
  admin: { orgId: "org-1", userId: "user-1", role: "ADMIN" },
  dispatcher: { orgId: "org-1", userId: "user-2", role: "DISPATCHER" },
  tech: { orgId: "org-1", userId: "user-3", role: "TECH" },
  otherOrgAdmin: { orgId: "org-other", userId: "user-other", role: "ADMIN" },
};
```

### Prisma Mocking (`src/__tests__/helpers/mock-prisma.ts`)

#### Function: `getMockPrisma()`
Returns the globally mocked Prisma instance for configuring return values.

```typescript
export function getMockPrisma() {
  return vi.mocked(prisma, true);
}
```

**Usage in tests**:
```typescript
const mockPrisma = getMockPrisma();

// Set up return value for next call
mockPrisma.workOrder.findMany.mockResolvedValue(workOrders);

// Make the API call
const res = await GET(req);

// Assert the mock was called correctly
expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: expect.objectContaining({ orgId: "org-1" }),
  })
);
```

#### Function: `resetPrismaMocks()`
Clears all mock implementations on Prisma (used in `beforeEach()`).

```typescript
export function resetPrismaMocks() {
  const mock = getMockPrisma();
  for (const model of Object.values(mock)) {
    if (typeof model === "object" && model !== null) {
      for (const method of Object.values(model)) {
        if (typeof method === "function" && "mockReset" in method) {
          (method as ReturnType<typeof vi.fn>).mockReset();
        }
      }
    }
  }
}
```

---

## Test Data Factories (`src/__tests__/helpers/test-data.ts`)

Factory functions create test objects with sensible defaults. Destructure `overrides` to customize.

### Available Factories

**WorkOrder Factory**:
```typescript
export function makeWorkOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "wo-1",
    orgId: "org-1",
    workOrderNumber: "WO00001",
    customerId: "cust-1",
    siteId: "site-1",
    title: "Fix pump bearing",
    status: "OPEN",
    // ... more fields
    ...overrides,
  };
}
```

**Usage**:
```typescript
const wo = makeWorkOrder({ status: "COMPLETED", title: "Custom title" });
const wo2 = makeWorkOrder({ id: "wo-2", workOrderNumber: "WO00002" });
```

**Other factories**: `makeOrg()`, `makeUser()`, `makeCustomer()`, `makeSite()`, `makeAsset()`, `makeQuote()`, `makeInvoice()`, `makeAuditLog()`

All follow the same pattern: default values + spread overrides.

---

## Test Categories & Examples

### 1. API Route Tests (Unit + Integration)

**File**: `src/__tests__/api/work-orders.test.ts`

Test the HTTP handler function for CRUD operations. Verify:
- Auth checks (401 unauthenticated, 403 unauthorized)
- Request body validation
- Prisma queries include orgId filter (multi-tenant isolation)
- Response status codes and shapes

**Example**:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMockPrisma } from "../helpers/mock-prisma";
import { createAuthenticatedRequest, createUnauthenticatedRequest } from "../helpers/mock-auth";
import { makeWorkOrder } from "../helpers/test-data";
import { GET, POST } from "@/app/api/work-orders/route";

const mockPrisma = getMockPrisma();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/work-orders", () => {
  it("returns 401 when unauthenticated", async () => {
    const req = createUnauthenticatedRequest("http://localhost/api/work-orders");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns work orders scoped to org", async () => {
    const workOrders = [makeWorkOrder(), makeWorkOrder({ id: "wo-2" })];
    mockPrisma.workOrder.findMany.mockResolvedValue(workOrders as any);

    const req = createAuthenticatedRequest("http://localhost/api/work-orders");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org-1" }),
      })
    );
  });
});

describe("POST /api/work-orders", () => {
  it("returns 403 when TECH role tries to create", async () => {
    mockForbiddenRole("TECH");
    const req = createAuthenticatedRequest("http://localhost/api/work-orders", {
      method: "POST",
      body: { customerId: "c1", siteId: "s1", title: "Test" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates work order successfully", async () => {
    const customer = makeCustomer();
    const site = makeSite();
    const wo = makeWorkOrder();

    mockPrisma.customer.findFirst.mockResolvedValue(customer as any);
    mockPrisma.site.findFirst.mockResolvedValue(site as any);
    mockPrisma.workOrder.create.mockResolvedValue(wo as any);

    const req = createAuthenticatedRequest("http://localhost/api/work-orders", {
      method: "POST",
      body: { customerId: "cust-1", siteId: "site-1", title: "Fix pump" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.id).toBe("wo-1");
  });
});
```

### 2. Auth Tests

**File**: `src/__tests__/api/auth.test.ts`

Test authentication and authorization logic. Verify:
- Default auth context returned by mocks
- Auth required check returns 401 when mocked unauthenticated
- Role-based access control (requireRole)

**Example**:
```typescript
describe("requireAuthSessionFirst", () => {
  it("returns auth context for authenticated requests", async () => {
    const req = new Request("http://localhost/api/test");
    const result = await requireAuthSessionFirst(req);
    expect("auth" in result).toBe(true);
    if ("auth" in result) {
      expect(result.auth.orgId).toBe("org-1");
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
});

describe("requireRole", () => {
  const adminAuth = { orgId: "org-1", userId: "user-1", role: "ADMIN" };

  it("returns null (passes) when role is allowed", () => {
    const result = requireRole(adminAuth, ["ADMIN", "DISPATCHER"]);
    expect(result).toBeNull();
  });

  it("returns 403 when role is not allowed", () => {
    const techAuth = { orgId: "org-1", userId: "user-3", role: "TECH" };
    mockedRequireRole.mockReturnValueOnce(
      NextResponse.json({ error: "Insufficient permissions." }, { status: 403 })
    );

    const result = requireRole(techAuth, ["ADMIN"]);
    expect(result!.status).toBe(403);
  });
});
```

### 3. Multi-Tenant Isolation Tests

**File**: `src/__tests__/api/multi-tenant.test.ts`

Verify that different orgs cannot access each other's data. Mock different org IDs and confirm Prisma queries filter correctly.

**Example**:
```typescript
describe("Multi-tenant isolation", () => {
  it("different orgs get different results", async () => {
    const orgAData = [makeWorkOrder({ orgId: "org-A", title: "Org A WO" })];
    const orgBData = [makeWorkOrder({ orgId: "org-B", title: "Org B WO" })];

    // First call for org-A
    mockAuthForOrg("org-A", "user-a");
    mockPrisma.workOrder.findMany.mockResolvedValueOnce(orgAData as any);
    const reqA = new Request("http://localhost/api/work-orders");
    const resA = await GET_WORK_ORDERS(reqA);
    const jsonA = await resA.json();

    // Second call for org-B
    mockAuthForOrg("org-B", "user-b");
    mockPrisma.workOrder.findMany.mockResolvedValueOnce(orgBData as any);
    const reqB = new Request("http://localhost/api/work-orders");
    const resB = await GET_WORK_ORDERS(reqB);
    const jsonB = await resB.json();

    // Verify each org gets only its data
    expect(jsonA.data[0].title).toBe("Org A WO");
    expect(jsonB.data[0].title).toBe("Org B WO");

    // Verify the calls were made with correct orgIds
    const calls = mockPrisma.workOrder.findMany.mock.calls;
    expect(calls[0][0].where.orgId).toBe("org-A");
    expect(calls[1][0].where.orgId).toBe("org-B");
  });
});
```

### 4. Library/Utility Tests

**File**: `src/__tests__/lib/audit.test.ts`

Test pure functions and utility libraries. Verify:
- Function behavior with different inputs
- Error handling and resilience
- JSON serialization of complex objects

**Example**:
```typescript
describe("createAuditLog", () => {
  it("creates an audit log entry", async () => {
    const auditLog = makeAuditLog();
    mockPrisma.auditLog.create.mockResolvedValue(auditLog as any);

    const result = await createAuditLog({
      userId: "user-1",
      orgId: "org-1",
      action: "CREATE",
      entityType: "WORK_ORDER",
      entityId: "wo-1",
      entityName: "WO00001",
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        orgId: "org-1",
        action: "CREATE",
      }),
    });
    expect(result).toEqual(auditLog);
  });

  it("stringifies changes and metadata as JSON", async () => {
    mockPrisma.auditLog.create.mockResolvedValue(makeAuditLog() as any);

    await createAuditLog({
      userId: "user-1",
      orgId: "org-1",
      action: "UPDATE",
      entityType: "WORK_ORDER",
      entityId: "wo-1",
      changes: { oldStatus: "OPEN", newStatus: "IN_PROGRESS" },
      metadata: { source: "api" },
    });

    const callData = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(callData.changes).toBe(
      JSON.stringify({ oldStatus: "OPEN", newStatus: "IN_PROGRESS" })
    );
    expect(callData.metadata).toBe(JSON.stringify({ source: "api" }));
  });

  it("swallows errors and logs to console", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.auditLog.create.mockRejectedValue(new Error("DB down"));

    const result = await createAuditLog({
      userId: "user-1",
      orgId: "org-1",
      action: "CREATE",
      entityType: "WORK_ORDER",
      entityId: "wo-1",
    });

    expect(result).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Create audit log error:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
```

---

## Test Structure Best Practices

### Setup & Teardown
Always include `beforeEach()` to clear mocks before each test.

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### Assertions
- **Use `.expect()`**: Vitest uses the same API as Jest.
- **Be specific**: Assert response status, data shape, and mock call arguments.
- **Test both success and failure paths**: Positive + negative cases.

### Naming
- **Describe blocks**: Describe what is being tested (e.g., "GET /api/work-orders").
- **Test cases**: Use human-readable `it()` labels that start with verbs (e.g., "returns 401 when unauthenticated").

### Avoid
- **Flaky tests**: Don't depend on Date/timestamps; use fake data or mock dates.
- **Skipped tests**: Don't use `.skip` or `.only`; they hide failures.
- **Tightly coupled mocks**: Avoid mocking internal helpers that don't cross module boundaries.

---

## Coverage Report

Generate and view test coverage:

```bash
npm run test:coverage
```

Coverage is tracked for:
- `src/lib/**/*.ts` (library utilities)
- `src/app/api/**/*.ts` (API routes)

Current status: **55 tests passing** across auth, CRUD operations, multi-tenant isolation, and utilities.

### Coverage Metrics
- **Statements**: Proportion of code lines executed.
- **Branches**: Conditional paths (if/else) executed.
- **Functions**: Function definitions called.
- **Lines**: Individual lines executed.

Aim for >80% coverage on critical paths (auth, data access, business logic).

---

## CI/CD Integration

Tests are run in CI/CD pipeline (typically on GitHub Actions or Vercel):
1. Install dependencies
2. Run `npm test` (full suite)
3. Generate coverage (optional)
4. Block PR if tests fail

---

## Troubleshooting

### Mock Not Working
- Ensure mock is defined in `src/__tests__/setup.ts`.
- Clear mocks in `beforeEach()` with `vi.clearAllMocks()`.
- Use `.mockResolvedValueOnce()` for single-call override; `.mockResolvedValue()` for all calls.

### Async Test Hangs
- Ensure Promises are awaited in test.
- Check that async mock resolves (not rejects unexpectedly).

### Type Errors
- Import types from `@prisma/client` for Prisma enums.
- Use generic type parameters for Prisma `as any` casts when mocking.

### Test Fails in CI but Passes Locally
- Ensure environment variables are set in CI (DATABASE_URL, etc.).
- Check for timezone-dependent logic (use fixed dates in tests).
- Verify Node.js version matches between local and CI.

---

## Summary

| Aspect | Pattern |
|--------|---------|
| **Framework** | Vitest 4.0.18 with jsdom environment |
| **Config** | `vitest.config.ts` with v8 coverage |
| **Test location** | `src/__tests__/**/*.test.ts` |
| **Mocking** | Global setup in `src/__tests__/setup.ts` + per-test overrides |
| **Auth mocks** | `createAuthenticatedRequest()`, `createUnauthenticatedRequest()`, `mockForbiddenRole()` |
| **Data factories** | `makeWorkOrder()`, `makeCustomer()`, etc. in `test-data.ts` |
| **Prisma mocks** | `getMockPrisma()` + `.mockResolvedValue()` for response simulation |
| **Coverage targets** | `src/lib/**/*.ts`, `src/app/api/**/*.ts` |
| **Run command** | `npm test`, `npm run test:watch`, `npm run test:coverage` |
| **Best practices** | Specific assertions, both success/failure cases, clear naming, avoid flakiness |
