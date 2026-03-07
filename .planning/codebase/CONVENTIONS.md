# ServiceOpsIQ Codebase Conventions

## Overview
This document describes the coding standards, patterns, and conventions used in the ServiceOpsIQ codebase (Next.js 16, React 19, TypeScript 5, Prisma 6).

---

## TypeScript Usage

### Types vs Interfaces
- **Types**: Used for unions, intersections, and complex shape definitions. See `src/lib/auth.ts` for auth context type definitions.
- **Interfaces**: Used sparingly for public API contracts (e.g., component prop types).
- **Preference**: Lean toward `type` for consistency across the codebase.

**Example from** `src/lib/auth.ts`:
```typescript
export type AuthContext = {
  orgId: string;
  userId: string;
  role: Role;
};
```

**Example from** `src/lib/forms/types.ts`:
```typescript
export type CalcOperation = 'SUM' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'AVERAGE' | 'MIN' | 'MAX' | 'COUNT';

export type PhotoValue = {
  photoId: string;
  url: string;
  capturedAt: string;
  gpsCoords?: { lat: number; lng: number };
};

export type FieldValue = string | number | boolean | null | PhotoValue | SignatureValue | GpsValue | FieldValue[];
```

### Enums
- Enums are **generated from Prisma schema** and imported from `@prisma/client` (e.g., `WorkOrderStatus`, `Role`, `TaskStatus`).
- Avoid creating duplicate enums in TypeScript; always source from Prisma.
- String enums used when `Object.values(EnumName).includes(value)` validation is required.

**Example from** `src/app/api/work-orders/route.ts`:
```typescript
import {
  ExecutionMode,
  OrderType,
  Role,
  WorkOrderStatus,
  WorkPackageType,
} from "@prisma/client";

if (auth.role === Role.TECH) {
  whereBase.OR = [
    { tasks: { some: { assignedToId: auth.userId } } },
    { visits: { some: { assignedTechId: auth.userId } } },
  ];
}

if (!Object.values(OrderType).includes(typeFilter)) {
  // Invalid filter
}
```

### Type Assertions
- **Minimize type assertions** (`as Type`). Use only when:
  1. Casting Prisma Decimal/BigInt to plain numbers.
  2. Mocking for tests (see `src/__tests__/api/work-orders.test.ts`).
  3. JSON parse results with confidence in data shape.
- Prefer casting via `.toNumber()` on Prisma Decimal fields.

---

## Component Patterns

### Server vs Client Components
- **Server Components** (default): Use for data fetching, auth checks, layout logic.
- **Client Components**: Add `"use client"` directive only when needed for interactivity (hooks, event handlers, browser APIs).

**Example (Server Component)** - `src/app/(app)/reports/page.tsx`:
```typescript
// No "use client" → Server component
export default function ReportsPage() {
  // Can fetch data directly
}
```

**Example (Client Component)** - `src/components/SidebarNav.tsx`:
```typescript
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function SidebarNav({ links, searchSlot, footerSlot }: SidebarNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // ...
}
```

### Component Structure
1. **Props typing**: Always define explicit `type ComponentProps = { ... }` or inline type.
2. **Default exports**: Use default exports for page components and main component exports.
3. **Export named utilities**: Export test helpers and factory functions as named exports.

**Example from** `src/components/filters/ExportButton.tsx`:
```typescript
"use client";

type ExportButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

export default function ExportButton({ onClick, disabled, label = "Export CSV" }: ExportButtonProps) {
  return (
    <button className="afp-export-btn" onClick={onClick} disabled={disabled}>
      {/* ... */}
    </button>
  );
}
```

### Hooks Usage
- **Custom hooks**: Placed in `src/hooks/` directory, named `useXxx.ts`.
- **Pattern**: Return object of state/functions; use `useCallback` for memoized functions passed to children.
- **Dependencies**: Always include complete dependency arrays in `useEffect`, `useCallback`, `useMemo`.

**Example from** `src/hooks/useAdvancedFilters.ts`:
```typescript
export function useAdvancedFilters(pageKey: string, configs: FilterConfig[]) {
  const [filters, setFilters] = useState<FilterState>(() => ({ ...defaultState }));
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadPresets(pageKey));

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const activeFilterCount = useMemo(() => {
    // Count active filters
    return count;
  }, [filters, configs]);

  return {
    filters,
    setFilter,
    clearAllFilters,
    activeFilterCount,
    hasActiveFilters,
    presets,
    savePreset,
    loadPreset,
    deletePreset,
  };
}
```

---

## API Route Patterns

### Route Structure
- **GET routes**: List/fetch operations, filtering via query params, pagination.
- **POST routes**: Create operations, validation via request body.
- **PATCH routes**: Update operations with specific field updates.
- **DELETE routes**: Remove operations with authorization checks.

### Auth Pattern
All routes must check authentication **first**, then role authorization. Use `requireAuthSessionFirst()` for Supabase session + fallback header auth.

**Pattern from** `src/app/api/work-orders/route.ts`:
```typescript
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const auth = authResult.auth;

  // Role check if needed
  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  // Fetch data with orgId filter
  const workOrders = await prisma.workOrder.findMany({
    where: { orgId: auth.orgId }, // ALWAYS include orgId for multi-tenant
    // ...
  });

  return NextResponse.json({ data: workOrders, total, limit, offset });
}
```

### Error Handling
- **Return Response objects**: Use `jsonError()` helper for error responses, or throw for middleware catch.
- **Error codes**:
  - `400`: Bad request (validation, missing fields)
  - `401`: Unauthenticated
  - `403`: Forbidden (insufficient role)
  - `404`: Not found
  - `500`: Server error (internal exception)

**Helper from** `src/lib/api-server.ts`:
```typescript
export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
```

**Usage**:
```typescript
if (!body?.customerId || !body?.siteId || !body?.title) {
  return jsonError("Customer ID, site ID, and title are required.");
}

if (!customer || !site) {
  return jsonError("Customer or site not found.", 404);
}
```

### Response Format
- **Successful responses**: `{ data: T, total?: number, limit?: number, offset?: number }`
- **Error responses**: `{ error: string, issues?: string[] }`

**Example**:
```typescript
return NextResponse.json({ data: workOrder }, { status: 201 });
return NextResponse.json({ data: workOrders, total, limit, offset });
return jsonError("Validation failed", 400);
```

### Multi-Tenant Isolation
**Critical**: Every database query MUST include `orgId` filter matching `auth.orgId`. This prevents data leakage between tenants.

**Pattern from** `src/app/api/work-orders/route.ts`:
```typescript
const whereBase: any = { orgId: auth.orgId };

if (auth.role === Role.TECH) {
  whereBase.OR = [
    { tasks: { some: { assignedToId: auth.userId } } },
    { visits: { some: { assignedTechId: auth.userId } } },
  ];
}

const [workOrders, total] = await Promise.all([
  prisma.workOrder.findMany({
    where: whereBase,
    // ...
  }),
  prisma.workOrder.count({ where: whereBase }),
]);
```

### Validation
- Use `validateBody<T>(request, schema)` from `src/lib/validation.ts` with Zod schemas.
- Throws `ValidationError` which has a `.toResponse()` method for automatic HTTP response.
- Inline validation via `parseJson()` for simple cases.

**Example from** `src/lib/validation.ts`:
```typescript
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const messages = result.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    );
    throw new ValidationError("Validation failed", messages);
  }

  return result.data;
}
```

---

## CSS Approach

### Design System (Not Tailwind)
The project uses **custom CSS variables**, not Tailwind CSS. All styling is done via CSS files with:
- CSS custom properties (CSS variables) defined in `:root`
- Semantic color tokens: `--primary`, `--accent`, `--success`, `--error`, `--warning`, `--info`
- Spacing scale: `--space-xs`, `--space-sm`, `--space`, `--space-md`, `--space-lg`, `--space-xl`, `--space-2xl`
- Typography: `--font-sans` (Space Grotesk), `--font-mono` (JetBrains Mono)

**From** `src/app/globals.css`:
```css
:root {
  /* Core Colors */
  --bg: #f6f5f2;
  --panel: #ffffff;
  --text: #111827;
  --text-light: #6b7280;
  --primary: #1f2937;
  --accent: #f97316;

  /* Semantic Colors */
  --success: #10b981;
  --error: #ef4444;
  --warning: #f59e0b;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space: 12px;
  --space-md: 16px;
  --space-lg: 24px;

  /* Typography */
  --font-sans: "Space Grotesk", "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", monospace;

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### CSS Organization
- **Component CSS**: Colocate `.css` files with components in same directory.
- **Global styles**: Only in `src/app/globals.css`.
- **BEM-like classes**: Use kebab-case class names, group related styles with semantic naming.

**Example from** `src/components/filters/ExportButton.tsx` (uses `AdvancedFilterPanel.css`):
```typescript
import "./AdvancedFilterPanel.css";

export default function ExportButton({ onClick, disabled, label = "Export CSV" }: ExportButtonProps) {
  return (
    <button className="afp-export-btn" onClick={onClick} disabled={disabled}>
      <span className="afp-export-icon">
        {/* ... */}
      </span>
      {label}
    </button>
  );
}
```

---

## Import Organization

### Order of Imports
1. **React/Next imports** (react, react-dom, next/*)
2. **Third-party libraries** (@prisma/client, zod, lucide-react, etc.)
3. **Internal absolute imports** (@/lib/*, @/components/*, @/types/*)
4. **Relative imports** (./sibling, ../parent)
5. **Style imports** (.css files)

**Example from** `src/app/api/work-orders/route.ts`:
```typescript
// React/Next
import { NextResponse } from "next/server";

// Third-party
import {
  ExecutionMode,
  OrderType,
  Role,
  WorkOrderStatus,
  WorkPackageType,
} from "@prisma/client";

// Internal absolute
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";

// No relative imports needed here
```

**Example from** `src/components/SidebarNav.tsx`:
```typescript
"use client";

// React
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

// Third-party
import {
  LayoutDashboard,
  Users,
  // ...
} from "lucide-react";

// (No style imports in this component)
```

### Path Aliases
- Use `@/` prefix for absolute imports into `src/` directory.
- Configured in `tsconfig.json`:
  ```json
  {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
  ```

---

## Error Handling

### API Routes
- **Validation errors**: Throw `ValidationError` from `src/lib/validation.ts`, catch in middleware, return `.toResponse()`.
- **Not found**: Return `jsonError(..., 404)`.
- **Forbidden**: Return `requireRole(...)` which returns 403 response.
- **Unexpected errors**: Let throw propagate to global error handler (Sentry logs them).

**Pattern**:
```typescript
try {
  const body = await validateBody(request, mySchema);
  // Process...
  return NextResponse.json({ data: result }, { status: 201 });
} catch (error) {
  if (error instanceof ValidationError) {
    return error.toResponse();
  }
  // Unhandled error logged by Sentry
  throw error;
}
```

### Audit Logging
- Use `createAuditLog()` from `src/lib/audit.ts` for all entity changes.
- Swallows internal errors (logs to console) to avoid blocking business logic.

**Example from** `src/lib/audit.ts`:
```typescript
export async function createAuditLog(params: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: params.userId,
        orgId: params.orgId,
        action: params.action,
        changes: params.changes ? JSON.stringify(params.changes) : null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (err) {
    console.error("Create audit log error:", err);
    // Swallow error; audit logging failure should not block the operation
  }
}
```

---

## State Management

### Server State (Preferred)
- Use React Server Components and direct Prisma queries when possible.
- Avoids client-side state synchronization issues.

### Client State (When Needed)
- **useState**: For local UI state (form inputs, modals, filters).
- **useCallback**: For memoized event handlers to pass to children.
- **useMemo**: For expensive computations or stable object references.
- **Context + Hooks**: For shared UI state (e.g., toast notifications, auth user).

**Example (Context Pattern)** - Toast notification system:
```typescript
// Provider wraps app; useToast() hook calls dispatch to add toast
// State is minimal: just array of toast objects
// Effects manage auto-removal by timeout
```

### Data Fetching
- **Server Components**: Fetch directly in component or use `getServerSideProps` equivalent.
- **Client Components**: Use fetch wrapper from `src/lib/api.ts` or custom hooks.
- **Caching**: Leverage Next.js fetch caching (`next: { revalidate: ... }`).

---

## Database & Prisma Patterns

### Model Design
- **Always include** `orgId` field on multi-tenant tables for isolation.
- **Use enums**: Define status enums in Prisma schema, not in TypeScript.
- **Relationships**: Use explicit foreign keys with `@relation()`.
- **Timestamps**: `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.

**Example from** `prisma/schema.prisma`:
```prisma
model WorkOrder {
  id                String   @id @default(uuid()) @db.Uuid
  orgId             String   @db.Uuid
  workOrderNumber   String
  customerId        String   @db.Uuid
  siteId            String   @db.Uuid
  title             String
  status            WorkOrderStatus @default(OPEN)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  org               Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  customer          Customer @relation(fields: [customerId], references: [id])
  site              Site     @relation(fields: [siteId], references: [id])

  // Indexes
  @@unique([orgId, workOrderNumber])
  @@index([orgId])
  @@index([customerId])
}
```

### Query Patterns
- **Include relations selectively**: Only fetch needed fields to reduce response size.
- **Pagination**: Use `take` and `skip` with `count()` for totals.
- **Filters**: Build where conditions dynamically; always include orgId.

**Example**:
```typescript
const [items, total] = await Promise.all([
  prisma.workOrder.findMany({
    where: { orgId: auth.orgId, status: "OPEN" },
    include: {
      customer: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  }),
  prisma.workOrder.count({ where: { orgId: auth.orgId, status: "OPEN" } }),
]);
```

---

## Summary of Key Conventions

| Aspect | Convention |
|--------|-----------|
| **Types** | Use `type`, not `interface` |
| **Enums** | Source from Prisma `@prisma/client` |
| **Components** | React hooks + `"use client"` only when needed |
| **APIs** | `requireAuthSessionFirst()` + orgId filter + `jsonError()` helper |
| **Styling** | CSS custom variables in `src/app/globals.css` (no Tailwind) |
| **Imports** | `@/` aliases; React, third-party, internal, styles order |
| **Errors** | Throw `ValidationError`, return response objects, audit log changes |
| **State** | Server components first; useState/useCallback/useMemo when needed |
| **Database** | Always include orgId; relationships with explicit @relation |
