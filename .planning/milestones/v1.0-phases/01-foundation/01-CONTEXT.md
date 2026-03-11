# Phase 1 Context: Foundation & Bug Fixes

**Phase:** 1 — Foundation
**Created:** 2026-03-08
**Gray areas discussed:** 0 (pure infrastructure phase — no user-facing decisions)

---

## Phase Goal

Fix the 4 live data-corruption bugs, pin the API version constant, add all required Prisma models and foreign-key fields, and write the type/mapper/queue modules that every subsequent phase depends on.

## Requirements

| ID | Description |
|----|-------------|
| FOUND-01 | Fix token refresh race condition — serialize refresh per connection via DB-level mutex |
| FOUND-02 | Fix sparse update data corruption — fetch full entity, merge changes, POST complete payload |
| FOUND-03 | Fix Decimal rounding — round to 2 decimal places before sending amounts to QBO |
| FOUND-04 | Pin minorversion=75 as named constant in all QBO API calls |
| FOUND-05 | Add Prisma models: QboSyncJob (durable queue), QboAccountMap (account mapping), QboCdcCursor (CDC timestamps) |
| FOUND-06 | Add fields to existing models: refreshTokenExpiry on QboConnection, qboEstimateId on Quote, qboItemId on Material/LaborRate, qboTimeActivityId on TimeEntry, qboVendorId on vendor records |
| FOUND-07 | Create qbo-types.ts with TypeScript interfaces for all QBO entity types |
| FOUND-08 | Create qbo-mapper.ts — pure transformation functions (ServiceOps ↔ QBO), no I/O |
| FOUND-09 | Create qbo-queue.ts — enqueue, claim, complete, fail, stale-lock detection helpers |

---

## Locked Decisions

### FOUND-01: Token Refresh Mutex

**Approach:** CAS (Compare-And-Swap) flag pattern on `QboConnection`.

**Why not `SELECT FOR UPDATE`:** Supabase uses PgBouncer for the pooled `DATABASE_URL` connection. PgBouncer in transaction mode does not support `SELECT FOR UPDATE SKIP LOCKED` because it reassigns the underlying connection between commands. Using the `directUrl` bypasses the pool but defeats the purpose of connection pooling in serverless.

**Implementation:**
1. Add `refreshInProgress Boolean @default(false)` and `refreshLockedAt DateTime?` to `QboConnection`
2. Before refreshing: atomically set `refreshInProgress = true` WHERE `refreshInProgress = false` (Prisma `updateMany` with `where` filter acts as CAS)
3. If CAS succeeds: perform refresh, update tokens, clear flag
4. If CAS fails (another instance is refreshing): poll the connection record with short backoff (100ms × 3) until `refreshInProgress` is cleared, then read the new `accessToken`
5. Stale lock safety: if `refreshLockedAt` is >30 seconds old, treat the lock as stale and allow re-acquisition
6. Always clear the lock in a `finally` block

**Database fields added:**
- `QboConnection.refreshInProgress` — Boolean, default false
- `QboConnection.refreshLockedAt` — DateTime, nullable

### FOUND-02: Sparse Update Fix

**Pattern:** Fetch-Merge-POST for every QBO entity update.

**Implementation:**
1. `getCustomer()` (already exists) returns the full QBO entity including SyncToken
2. Deep-merge ServiceOps changes into the fetched entity
3. POST the complete merged payload
4. Apply this pattern to the existing `updateCustomer()` and establish it as the pattern for all future entity update functions

**Code location:** `qbo-client.ts:updateCustomer()` (lines 262-288)

**Current bug:** Only sends `Id`, `SyncToken`, `DisplayName`, and optionally `PrimaryEmailAddr` — QBO replaces the entire entity, clearing phone, address, payment terms, and all other fields.

### FOUND-03: Decimal Rounding

**Pattern:** `Number(value.toFixed(2))` before any amount reaches a QBO API payload.

**Where to apply:**
- `syncInvoiceToQbo()` line items: `Number(item.totalPrice)`, `Number(item.quantity)`, `Number(item.unitPrice)`
- All future mapper functions in `qbo-mapper.ts` that produce monetary amounts

**Helper:** Add `roundQboAmount(value: Decimal | number): number` to `qbo-mapper.ts` for consistent usage.

### FOUND-04: Pin minorversion=75

**Implementation:**
1. Add `const QBO_API_VERSION = "75"` as a named constant in `qbo-client.ts`
2. Append `?minorversion=${QBO_API_VERSION}` to all QBO API URLs in `qboRequest()`
3. Export the constant for reference in tests and documentation

**Why 75:** Intuit deprecated all minor versions below 75 as of August 1, 2025. Version 75 is the current stable baseline.

### FOUND-05: New Prisma Models

**QboSyncJob** — Durable queue for all QBO operations:
- `id`, `orgId`, `connectionId`
- `entityType` — String (customer, invoice, estimate, item, employee, vendor, timeActivity, expense, payment, creditMemo)
- `entityId` — UUID reference to ServiceOps entity
- `action` — String (push, pull, void, email)
- `priority` — Int (1 = user-triggered real-time, 5 = CDC-driven inbound, 9 = bulk initial sync)
- `status` — String (pending, claimed, completed, failed, dead_letter)
- `payload` — Json? (optional pre-computed payload to avoid re-querying)
- `attempts` — Int @default(0)
- `maxAttempts` — Int @default(3)
- `lockedAt` — DateTime? (null when pending; set when claimed)
- `lockedBy` — String? (serverless instance identifier)
- `completedAt` — DateTime?
- `errorMessage` — String? @db.Text
- `createdAt`, `updatedAt`
- Indexes: `[orgId, status, priority]`, `[status, lockedAt]` (for stale lock detection)

**QboAccountMap** — User-configured account assignments:
- `id`, `orgId`
- `category` — String (labor_income, materials_income, service_income, job_cost_expense, subcontractor_expense)
- `qboAccountId` — String (QBO Account entity ID)
- `qboAccountName` — String (cached display name for UI)
- `qboAccountType` — String (Income, Expense, Cost of Goods Sold)
- `createdAt`, `updatedAt`
- Unique constraint: `[orgId, category]`

**QboCdcCursor** — CDC poll timestamps:
- `id`, `orgId`, `connectionId`
- `lastPollAt` — DateTime (the `changedSince` parameter for next CDC call)
- `lastPollStatus` — String (success, failed)
- `lastPollError` — String? @db.Text
- `entityTypes` — String (comma-separated list of entity types polled)
- `createdAt`, `updatedAt`
- Unique constraint: `[orgId]`

### FOUND-06: Fields on Existing Models

| Model | Field | Type | Purpose |
|-------|-------|------|---------|
| QboConnection | refreshTokenExpiry | DateTime? | Track 100-day refresh token expiry for proactive monitoring |
| QboConnection | refreshInProgress | Boolean @default(false) | CAS flag for token refresh mutex |
| QboConnection | refreshLockedAt | DateTime? | Stale lock detection for token refresh |
| Quote | qboEstimateId | String? | QBO Estimate entity ID after sync |
| Quote | qboSyncedAt | DateTime? | Last sync timestamp |
| Material | qboItemId | String? | QBO Item entity ID after sync |
| LaborRate | qboItemId | String? | QBO Item entity ID after sync |
| TimeEntry | qboTimeActivityId | String? | QBO TimeActivity entity ID after sync |

**Note on vendor:** The schema does not currently have a standalone Vendor model. Vendors are referenced through `StockMovement.reference` and potentially the future PO system. The `qboVendorId` field will be deferred to Phase 5 (VEND-01) when the Vendor model is created, or added to whichever existing model maps to QBO Vendors.

### FOUND-07: QBO Types Scope

**Coverage:** All QBO entity types needed across all 6 phases. Define them all now — they're pure interfaces with no runtime cost, and having the complete type system prevents mapper/sync code from using `any` or `Record<string, unknown>`.

**Entity interfaces to define:**
- `QboCustomer` (expand existing inline type in qbo-client.ts)
- `QboInvoice` (expand existing inline type)
- `QboPayment`
- `QboEstimate`
- `QboItem` (Product/Service)
- `QboEmployee`
- `QboVendor`
- `QboTimeActivity`
- `QboBill`
- `QboPurchase`
- `QboPurchaseOrder`
- `QboCreditMemo`
- `QboAccount` (Chart of Accounts)
- `QboClass`
- `QboLocation` (Department)
- `QboPreferences` (Company settings — for Class/Location tracking check)
- `QboCompanyInfo` (expand existing)
- Common types: `QboRef` (value + name), `QboAddress`, `QboEmailAddr`, `QboPhoneNumber`, `QboLine`, `QboLinkedTxn`, `QboMetaData` (SyncToken, LastUpdatedTime)

**Source:** Intuit Developer API Reference, minorversion=75 field definitions.

### FOUND-08: Mapper Design

**Pattern:** One pure function per entity per direction.

```
toQboCustomer(customer: ServiceOpsCustomer, existingQbo?: QboCustomer): QboCustomerPayload
fromQboCustomer(qboCustomer: QboCustomer): Partial<ServiceOpsCustomerUpdate>
```

**Rules:**
- Every function is pure — no database calls, no API calls, no side effects
- Merge pattern: if `existingQbo` is provided, merge ServiceOps changes into the existing entity (solves FOUND-02)
- All monetary values pass through `roundQboAmount()` (solves FOUND-03)
- Functions receive ServiceOps Prisma types and return QBO API payload shapes
- Fully unit-testable without mocking

**Initial mappers (enough for Phase 2-3):**
- Customer (both directions — Phase 2-4)
- Invoice (outbound — Phase 2-3)
- Estimate (outbound — Phase 3)
- Item (outbound — Phase 3)
- InvoiceLine (outbound — Phase 3, with ItemRef)

**Future mappers added in their respective phases:**
- Employee, Vendor, TimeActivity, Bill, Purchase, PO, CreditMemo, Payment (Phases 4-6)

### FOUND-09: Queue Design

**Helpers:**
- `enqueue(orgId, entityType, entityId, action, priority?, payload?)` — insert QboSyncJob with status=pending
- `claimBatch(limit: number)` — atomically claim up to N pending jobs (oldest first, priority-ordered), set status=claimed + lockedAt + lockedBy
- `complete(jobId, qboEntityId?)` — mark completed, set completedAt
- `fail(jobId, errorMessage)` — increment attempts; if attempts >= maxAttempts, set status=dead_letter; else reset to pending for retry
- `resetStaleLocks(maxAgeSeconds: number)` — find jobs where status=claimed AND lockedAt < (now - maxAge), reset to pending
- `getDeadLetters(orgId)` — return dead_letter jobs for dashboard display
- `requeueDeadLetter(jobId)` — reset dead_letter job to pending with attempts=0

**Atomic claiming:** Use Prisma `$executeRaw` with `UPDATE ... WHERE status = 'pending' ORDER BY priority ASC, createdAt ASC LIMIT $1 RETURNING *` for true atomic batch claiming. Fallback: use Prisma `findMany` + `updateMany` in a transaction if raw SQL is problematic.

**Constants:**
- `STALE_LOCK_SECONDS = 120`
- `DEFAULT_MAX_ATTEMPTS = 3`
- `DEFAULT_BATCH_SIZE = 30`

---

## Code Context

### Files to modify:
- `src/lib/qbo/qbo-client.ts` — Fix FOUND-01, FOUND-02, FOUND-03, FOUND-04 (lines 162-217, 262-288)
- `prisma/schema.prisma` — Add models (FOUND-05), add fields (FOUND-06)

### Files to create:
- `src/lib/qbo/qbo-types.ts` — FOUND-07
- `src/lib/qbo/qbo-mapper.ts` — FOUND-08
- `src/lib/qbo/qbo-queue.ts` — FOUND-09

### Existing patterns to follow:
- All models use `@id @default(uuid()) @db.Uuid` for primary keys
- All models include `orgId String @db.Uuid` + `@@index([orgId])` for multi-tenancy
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Relations: explicit foreign key fields with `@relation`
- QBO sync already uses `QboSyncLog` for audit trail — new modules should log there too
- Error pattern: try/catch → log to QboSyncLog → return `{ success, error }` result type

### Existing QBO types to migrate:
- `TokenResponse` at `qbo-client.ts:16` — keep in qbo-client (auth-specific)
- `QboCustomer` at `qbo-client.ts:22` — move to qbo-types.ts, expand
- `QboInvoice` at `qbo-client.ts:35` — move to qbo-types.ts, expand

---

## Deferred Ideas

- Vendor model creation — no standalone Vendor model exists yet. Will be addressed in Phase 5 (VEND-01).
- `intuit-oauth` package — only add if Intuit's production app review requires it. Research says raw fetch is preferred.

---

*Created: 2026-03-08*
*Phase: 01-foundation*
*Gray areas: None (pure infrastructure)*
