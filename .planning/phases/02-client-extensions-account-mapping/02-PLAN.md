---
phase: 2
plan: 02
title: Account Mapping API Routes + Prerequisite Gate Helpers
wave: 1
depends_on: []
requirements: [ACCT-01, ACCT-03]
files_modified:
  - src/app/api/integrations/qbo/accounts/route.ts
  - src/app/api/integrations/qbo/account-mapping/route.ts
  - src/lib/qbo/qbo-sync.ts
autonomous: true
estimated_effort: medium
---

# Plan 02: Account Mapping API Routes + Prerequisite Gate Helpers

<context>
## Background
Phase 2 requires fetching the Chart of Accounts from QBO (ACCT-01) and enforcing a prerequisite gate that blocks financial syncs when account mapping is incomplete (ACCT-03). This plan creates:

1. Two new API routes: one to fetch QBO accounts live, one for account mapping CRUD
2. Two helper functions in `qbo-sync.ts`: `getAccountMapping()` and `requireAccountMapping()`
3. A gate check inserted into `syncInvoiceToQbo()` to block syncs when mapping is missing

The QBO accounts are NOT cached in the DB (per user decision) — they are re-fetched live from the QBO query API via `queryEntities()` each time the settings page loads. The account mapping uses the existing `QboAccountMap` Prisma model (created in Phase 1) with `@@unique([orgId, category])`.

This plan does NOT touch the UI (page.tsx/CSS) — that's Plan 04. It does NOT implement the client methods (`queryEntities`, etc.) — that's Plan 01. The API routes call the client methods, so they'll work once Plan 01 is merged. For the gate helpers, only Prisma queries are needed (no QBO API calls).
</context>

<tasks>
## Tasks

### Task 1: Create GET /api/integrations/qbo/accounts route

Create the file `src/app/api/integrations/qbo/accounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { queryEntities } from "@/lib/qbo/qbo-client";
import type { QboAccount } from "@/lib/qbo/qbo-types";

// GET /api/integrations/qbo/accounts
// Fetches active accounts from QBO for the connected org.
// Used by the account mapping UI to populate dropdowns.
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  // Get active QBO connection
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "No active QBO connection" },
      { status: 400 }
    );
  }

  try {
    // Fetch all active accounts from QBO (Income, Expense, COGS)
    // Typical company has <300 accounts, so no pagination needed
    const accounts = await queryEntities<QboAccount>(
      connection,
      "SELECT * FROM Account WHERE Active = true MAXRESULTS 1000",
      "Account"
    );

    return NextResponse.json({ data: accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### Task 2: Create GET/PUT /api/integrations/qbo/account-mapping route

Create the file `src/app/api/integrations/qbo/account-mapping/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

const VALID_CATEGORIES = [
  "labor_income",
  "materials_income",
  "service_income",
  "job_cost_expense",
  "subcontractor_expense",
] as const;

// GET /api/integrations/qbo/account-mapping
// Returns all saved account mappings for the org.
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const mappings = await prisma.qboAccountMap.findMany({
    where: { orgId },
    select: {
      category: true,
      qboAccountId: true,
      qboAccountName: true,
      qboAccountType: true,
    },
  });

  // Return as a record keyed by category for easy lookup
  const mappingMap: Record<string, {
    qboAccountId: string;
    qboAccountName: string;
    qboAccountType: string;
  }> = {};

  for (const m of mappings) {
    mappingMap[m.category] = {
      qboAccountId: m.qboAccountId,
      qboAccountName: m.qboAccountName,
      qboAccountType: m.qboAccountType,
    };
  }

  return NextResponse.json({ data: mappingMap });
}

// PUT /api/integrations/qbo/account-mapping
// Upsert a single account mapping for a category.
// Body: { category, qboAccountId, qboAccountName, qboAccountType }
export async function PUT(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId, role } = authResult.auth;

  // Only ADMINs can configure account mapping
  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can configure account mapping" },
      { status: 403 }
    );
  }

  let body: {
    category: string;
    qboAccountId: string;
    qboAccountName: string;
    qboAccountType: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { category, qboAccountId, qboAccountName, qboAccountType } = body;

  // Validate category
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json(
      { error: `Invalid category: ${category}. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!qboAccountId || !qboAccountName || !qboAccountType) {
    return NextResponse.json(
      { error: "qboAccountId, qboAccountName, and qboAccountType are required" },
      { status: 400 }
    );
  }

  // Upsert using the @@unique([orgId, category]) constraint
  const mapping = await prisma.qboAccountMap.upsert({
    where: {
      orgId_category: { orgId, category },
    },
    create: {
      orgId,
      category,
      qboAccountId,
      qboAccountName,
      qboAccountType,
    },
    update: {
      qboAccountId,
      qboAccountName,
      qboAccountType,
    },
  });

  return NextResponse.json({
    data: {
      category: mapping.category,
      qboAccountId: mapping.qboAccountId,
      qboAccountName: mapping.qboAccountName,
      qboAccountType: mapping.qboAccountType,
    },
  });
}
```

### Task 3: Add prerequisite gate helpers to qbo-sync.ts

Add two new exported functions to `src/lib/qbo/qbo-sync.ts`, after the `getActiveConnection()` function and before `syncCustomerToQbo()`:

```typescript
// ============================================
// ACCOUNT MAPPING PREREQUISITE GATE
// ============================================

/** All 5 required mapping categories for financial syncs */
const REQUIRED_MAPPING_CATEGORIES = [
  "labor_income",
  "materials_income",
  "service_income",
  "job_cost_expense",
  "subcontractor_expense",
];

/**
 * Get a specific account mapping for an org and category.
 * Returns the mapping if found, or throws a descriptive error.
 */
export async function getAccountMapping(
  orgId: string,
  category: string
): Promise<{ qboAccountId: string; qboAccountName: string; qboAccountType: string }> {
  const mapping = await prisma.qboAccountMap.findUnique({
    where: {
      orgId_category: { orgId, category },
    },
    select: {
      qboAccountId: true,
      qboAccountName: true,
      qboAccountType: true,
    },
  });

  if (!mapping) {
    throw new Error(
      `Account mapping required for "${category}" — configure in QBO Settings`
    );
  }

  return mapping;
}

/**
 * Check if all required account mappings are configured for an org.
 * Returns { complete: true, missing: [] } when all 5 categories are mapped.
 * Returns { complete: false, missing: [...] } when any are missing.
 */
export async function requireAccountMapping(
  orgId: string
): Promise<{ complete: boolean; missing: string[] }> {
  const mappings = await prisma.qboAccountMap.findMany({
    where: { orgId },
    select: { category: true },
  });

  const mappedCategories = new Set(mappings.map((m) => m.category));
  const missing = REQUIRED_MAPPING_CATEGORIES.filter(
    (cat) => !mappedCategories.has(cat)
  );

  return {
    complete: missing.length === 0,
    missing,
  };
}
```

### Task 4: Wire the prerequisite gate into syncInvoiceToQbo()

In `src/lib/qbo/qbo-sync.ts`, modify `syncInvoiceToQbo()` to call `requireAccountMapping()` BEFORE any QBO API calls. Insert the gate check right after the connection check and before the invoice lookup:

Find this code block in `syncInvoiceToQbo()`:
```typescript
  const connection = await getActiveConnection(orgId);
  if (!connection) {
    return { success: false, error: "No active QBO connection" };
  }

  const invoice = await prisma.invoice.findFirst({
```

Replace with:
```typescript
  const connection = await getActiveConnection(orgId);
  if (!connection) {
    return { success: false, error: "No active QBO connection" };
  }

  // Prerequisite gate: require account mapping before financial sync
  const accountMapping = await requireAccountMapping(orgId);
  if (!accountMapping.complete) {
    return {
      success: false,
      error: `Account mapping required — configure in QBO Settings. Missing: ${accountMapping.missing.join(", ")}`,
    };
  }

  const invoice = await prisma.invoice.findFirst({
```

Note: `syncCustomerToQbo()` does NOT get the gate — customer sync is not a financial transaction.

</tasks>

<verification>
## Verification
- [ ] `npx tsc --noEmit` completes with zero TypeScript errors
- [ ] File exists: `src/app/api/integrations/qbo/accounts/route.ts` with GET handler
- [ ] File exists: `src/app/api/integrations/qbo/account-mapping/route.ts` with GET and PUT handlers
- [ ] Account mapping PUT route validates `category` against the 5 valid categories
- [ ] Account mapping PUT route requires ADMIN role (returns 403 for non-admin)
- [ ] Account mapping GET route returns data as a `Record<string, {...}>` keyed by category
- [ ] `getAccountMapping()` throws with descriptive error when category not found
- [ ] `requireAccountMapping()` returns `{ complete: true, missing: [] }` when all 5 categories exist
- [ ] `requireAccountMapping()` returns missing categories when some are absent
- [ ] `syncInvoiceToQbo()` returns `{ success: false, error: "Account mapping required..." }` when mapping incomplete
- [ ] `syncInvoiceToQbo()` gate fires BEFORE any QBO API calls (before `createInvoice`)
- [ ] `syncCustomerToQbo()` does NOT have the gate check
- [ ] Build succeeds: `npm run build` completes without errors
</verification>

<must_haves>
## Must-Haves (Goal-Backward)
- `GET /api/integrations/qbo/accounts` fetches live QBO accounts via `queryEntities()` — no DB caching
- `GET /api/integrations/qbo/account-mapping` returns saved mappings for the org
- `PUT /api/integrations/qbo/account-mapping` upserts a single category mapping (ADMIN only)
- `requireAccountMapping(orgId)` returns `{ complete, missing }` — the gate check used by all financial sync functions
- `syncInvoiceToQbo()` blocks with clear error when account mapping is incomplete — no financial data reaches QBO
- All API routes follow multi-tenant pattern: `requireAuthSessionFirst(request)` + `orgId` in all queries
</must_haves>
