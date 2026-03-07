# Architecture Research: QBO Full Integration

*Scope: Expanding the existing 393-line qbo-client.ts + 293-line qbo-sync.ts into a full 19-point integration within the existing Next.js 16.1 / Prisma 6.16 / Supabase / Vercel stack.*

---

## Module Organization

The current `src/lib/qbo/` directory holds two files. The full integration requires splitting responsibilities across eight focused modules plus a new set of API routes.

### Proposed `src/lib/qbo/` Layout

```
src/lib/qbo/
├── qbo-client.ts          # EXISTING — raw HTTP, OAuth, token refresh
│                          # EXTEND: add batch(), queryEntities(), sendEmail(), voidInvoice()
├── qbo-sync.ts            # EXISTING — customer + invoice push, webhook handler skeleton
│                          # REFACTOR: decompose into focused sync modules below
│
├── qbo-types.ts           # NEW — all QBO entity TypeScript interfaces
│                          # QboCustomer, QboInvoice, QboEstimate, QboItem, QboEmployee,
│                          # QboVendor, QboTimeActivity, QboPayment, QboClass, QboAccount,
│                          # QboCdcResponse, QboBatchRequest, QboBatchResponse
│
├── qbo-mapper.ts          # NEW — bidirectional field mapping layer
│                          # ServiceOps entity → QBO payload builders
│                          # QBO response → ServiceOps field extractors
│                          # No I/O — pure transformation functions only
│
├── qbo-account-map.ts     # NEW — account mapping resolution
│                          # loadAccountMap(orgId), resolveAccount(orgId, category)
│                          # Reads QboAccountMap model from Prisma
│
├── qbo-outbound.ts        # NEW — all outbound push functions
│                          # syncCustomer, syncInvoice, syncEstimate, syncItem,
│                          # syncEmployee, syncVendor, syncTimeActivity,
│                          # syncExpense, voidInvoice, createCreditMemo,
│                          # sendInvoiceEmail, applyClassTracking
│                          # Each function: fetch entity → map → call client → log
│
├── qbo-inbound.ts         # NEW — all inbound pull functions
│                          # pullCustomers, pullItems, pullAccounts,
│                          # pullPaymentStatus, pullEstimateStatus
│                          # Upserts data into ServiceOps Prisma models
│
├── qbo-cdc.ts             # NEW — Change Data Capture polling engine
│                          # runCdcPoll(orgId, connection) — called by Vercel Cron
│                          # Calls QBO /cdc endpoint, routes changed entities to handlers
│
├── qbo-webhook.ts         # NEW — complete webhook dispatch layer
│                          # Extracted from qbo-sync.ts; handles all entity types
│                          # Replaces the skeletal handleQboPaymentWebhook()
│
└── qbo-queue.ts           # NEW — job queue read/write helpers
                           # enqueueSync(), claimNextJob(), markDone(), markFailed()
                           # Wraps Prisma QboSyncJob model
```

### New API Routes

```
src/app/api/integrations/qbo/
├── connect/route.ts       # EXISTING
├── callback/route.ts      # EXISTING
├── disconnect/route.ts    # EXISTING
├── status/route.ts        # EXISTING
├── sync/route.ts          # EXISTING — extend to cover new entity types
├── webhook/route.ts       # EXISTING — rewire to qbo-webhook.ts dispatcher
│
├── accounts/route.ts      # NEW — GET chart of accounts, POST save account mapping
├── items/route.ts         # NEW — GET/POST item sync (materials + labor rates)
├── cdc/route.ts           # NEW — POST endpoint called by Vercel Cron
├── reports/route.ts       # NEW — proxy QBO Reports API (P&L, A/R Aging, Balance Sheet)
└── health/route.ts        # NEW — integration health summary + recent sync log
```

### New Prisma Models Required

```prisma
// Job queue — durable across serverless cold starts
model QboSyncJob {
  id          String    @id @default(uuid()) @db.Uuid
  orgId       String    @db.Uuid
  entityType  String    // "customer" | "invoice" | "estimate" | "item" | ...
  entityId    String    // ServiceOps entity UUID
  direction   String    // "push" | "pull"
  priority    Int       @default(5) // 1=highest, 10=lowest
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  status      String    @default("pending") // "pending" | "processing" | "done" | "dead"
  lockedAt    DateTime? // set when a serverless invocation claims the job
  lockedBy    String?   // invocation ID to detect stale locks
  nextRetryAt DateTime  @default(now())
  errorMessage String?  @db.Text
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([orgId, status, nextRetryAt])
  @@index([status, nextRetryAt])
}

// Account mapping — user-configured QBO account assignments
model QboAccountMap {
  id          String   @id @default(uuid()) @db.Uuid
  orgId       String   @db.Uuid
  category    String   // "labor" | "materials" | "travel" | "expenses" | "tax" | ...
  qboAccountId   String  // QBO Account.Id
  qboAccountName String  // display only, denormalized for UI
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([orgId, category])
  @@index([orgId])
}

// CDC cursor — tracks last poll timestamp per org
model QboCdcCursor {
  id          String   @id @default(uuid()) @db.Uuid
  orgId       String   @unique @db.Uuid
  lastPollAt  DateTime // passed as ?changedSince= to QBO CDC endpoint
  updatedAt   DateTime @updatedAt
}
```

Additionally, extend existing models:

```
Customer:  qboCustomerId (existing), qboSyncedAt DateTime?
Invoice:   qboInvoiceId (existing), qboSyncedAt (existing), qboBalance Decimal?
Quote:     qboEstimateId String?, qboEstimateSyncedAt DateTime?
Material:  qboItemId String?, qboItemSyncedAt DateTime?
LaborRate: qboItemId String?, qboItemSyncedAt DateTime?
Visit:     qboTimeActivityId String?, qboTimeActivitySyncedAt DateTime?
Vendor:    qboVendorId String?, qboVendorSyncedAt DateTime?
```

---

## Sync Engine Design

### Direction Conventions

- **Outbound (push)**: ServiceOps is the source of truth. ServiceOps entity changes trigger QBO creates/updates.
- **Inbound (pull)**: QBO is the source of truth for financial status. Payments, voids, balance changes flow back into ServiceOps.
- **Bidirectional**: Customers and Items — initial push from ServiceOps; QBO-created records pulled in via CDC.

### Outbound Push Flow

```
ServiceOps entity event
  (API route saves record to Prisma)
        |
        v
  enqueueSync(orgId, entityType, entityId, "push")
  -- writes QboSyncJob row, status=pending --
        |
     [async]
        v
  POST /api/integrations/qbo/sync  (manual trigger)
  OR
  Vercel Cron → POST /api/cron/qbo-flush (every 5 min)
        |
        v
  qbo-queue.ts: claimNextJob() — atomic UPDATE WHERE status='pending' SET status='processing', lockedAt=now()
        |
        v
  qbo-outbound.ts: sync[EntityType](orgId, entityId)
    1. Load ServiceOps entity from Prisma (with relations)
    2. Check: already synced? skip if qboId present + no changes
    3. loadAccountMap(orgId) via qbo-account-map.ts
    4. Build QBO payload via qbo-mapper.ts
    5. Call qbo-client.ts (create or update + SyncToken fetch)
    6. Write qboId back to Prisma entity
    7. Write QboSyncLog: success
    8. markDone(jobId)
        |
   [on error]
        v
    markFailed(jobId) — increment attempts, set nextRetryAt (exponential backoff)
    Write QboSyncLog: failed + errorMessage
    If attempts >= maxAttempts → status='dead', alert via notification
```

### Inbound Pull Flow (CDC polling)

```
Vercel Cron: 0 */4 * * *  (every 4 hours)
  → POST /api/cron/qbo-cdc (secured with CRON_SECRET)
        |
        v
  For each org with active QboConnection:
    1. Load QboCdcCursor.lastPollAt for org (or connectedAt if first run)
    2. Call QBO GET /cdc?entities=Customer,Invoice,Estimate,Item,Payment,Vendor
                        &changedSince={ISO timestamp}
    3. Parse QboCdcResponse — list of changed entities per type
    4. Route each entity type to handler in qbo-inbound.ts:
         - Customer → upsert Customer (by qboCustomerId)
         - Invoice  → update invoice status, balance, payment state
         - Payment  → mark invoice PAID if Balance=0
         - Estimate → update quote status (accepted/rejected)
         - Item     → upsert Material or LaborRate
    5. Write QboSyncLog per entity processed
    6. Update QboCdcCursor.lastPollAt = now()
```

### Webhook Handler Flow (Inbound, Event-Driven)

```
QBO → POST /api/integrations/qbo/webhook
  1. Read raw body (must be read before parse for HMAC)
  2. Verify intuit-signature header (HMAC-SHA256) — reject 401 if invalid
  3. Parse JSON payload
  4. Return 200 immediately (QBO has 5-second timeout)
  5. Process synchronously within same invocation:
     For each eventNotification:
       Lookup QboConnection by realmId
       For each entity in dataChangeEvent.entities:
         Route to qbo-webhook.ts handler by entity.name:
           "Payment"  → fetchPaymentFromQbo → apply to invoice → mark PAID/PARTIAL
           "Invoice"  → fetchInvoiceFromQbo → sync balance + status
           "Customer" → fetchCustomerFromQbo → upsert ServiceOps customer
           "Estimate" → fetchEstimateFromQbo → upsert quote status
         Write QboSyncLog per entity
```

Note on webhook vs. CDC: Webhooks are event-driven but can be delayed or missed. CDC polling is the reliability backstop. Both paths write to the same Prisma models; all writes are idempotent upserts.

---

## Entity Mapping Layer

The mapping layer lives entirely in `qbo-mapper.ts`. No Prisma calls — pure data transformation only. This makes it testable without a database.

### ServiceOps → QBO Mappings

| ServiceOps Entity | QBO Entity | Key Field Mappings |
|---|---|---|
| Customer | Customer | name → DisplayName, primaryEmail → PrimaryEmailAddr.Address, primaryPhone → PrimaryPhone.FreeFormNumber, billingStreet1/City/State/PostalCode → BillAddr |
| Invoice | Invoice | invoiceNumber → DocNumber, dueDate → DueDate, lineItems → Line[], customer.qboCustomerId → CustomerRef.value, classId → ClassRef.value (if class tracking on) |
| Quote | Estimate | quoteNumber → DocNumber, lineItems → Line[], expiresAt → ExpirationDate, customer.qboCustomerId → CustomerRef.value |
| Material (catalog) | Item (Inventory/Service) | name → Name, description → Description, unitCost → PurchaseCost, unitPrice → UnitPrice, qbo account map → IncomeAccountRef + ExpenseAccountRef |
| LaborRate | Item (Service) | name → Name, ratePerHour → UnitPrice, qbo account map → IncomeAccountRef |
| Visit (time entry) | TimeActivity | durationMinutes → Hours, tech.qboEmployeeId → EmployeeRef.value, workOrder.description → Description, date → TxnDate |
| Vendor | Vendor | name → DisplayName, email → PrimaryEmailAddr.Address, phone → PrimaryPhone.FreeFormNumber |
| JobExpense | Purchase or Bill | amount → TotalAmt, vendor.qboVendorId → EntityRef, qbo account map category → AccountRef.value |

### QBO → ServiceOps Mappings (Inbound)

| QBO Entity | ServiceOps Field Updates |
|---|---|
| Payment (Balance=0 on Invoice) | Invoice.status = PAID, Invoice.paidAt = TxnDate |
| Payment (Balance > 0 on Invoice) | Invoice.status = PARTIAL (if enum exists), Invoice.qboBalance = Balance |
| Invoice (Voided) | Invoice.status = VOID |
| Estimate (Accepted) | Quote.status = ACCEPTED |
| Estimate (Rejected/Closed) | Quote.status = REJECTED |
| Customer (CDC updated) | Customer.name/email/phone upserted — only if ServiceOps record was NOT the last writer (use qboSyncedAt vs updatedAt comparison to detect conflict) |

### SyncToken Handling

Every QBO entity update requires the current SyncToken to prevent overwrite conflicts. The pattern in qbo-client.ts already does this for customers. All update functions in qbo-outbound.ts must follow the same pattern: GET the entity, extract SyncToken, include it in the POST body. Never cache SyncTokens between calls — always re-fetch.

---

## Queue and Retry Architecture

Serverless functions on Vercel have a 60-second maximum execution time. A bulk sync of 500 invoices cannot run in a single invocation. The queue provides durability and chunking.

### Design Principles

1. **Prisma-based queue** — no external service needed (no Redis, no SQS). QboSyncJob table in PostgreSQL. Fits the existing stack.
2. **Atomic job claiming** — use a single `UPDATE ... WHERE status='pending' AND nextRetryAt <= now() LIMIT 30 RETURNING *` to atomically claim a batch. Prevents two concurrent invocations processing the same job.
3. **Stale lock detection** — jobs locked more than 120 seconds ago with status='processing' are considered abandoned (invocation died). A cleanup step at the start of each cron run resets them to pending.
4. **Exponential backoff** — nextRetryAt = now() + (2^attempts * 30 seconds). Caps at 1 hour.
5. **Dead letter** — after maxAttempts (default 3) a job moves to status='dead'. Dead jobs surface in the integration health dashboard. Manual re-queue available via admin UI.
6. **Priority** — outbound pushes triggered by real-time user actions get priority=1. CDC-driven inbound gets priority=5. Bulk initial sync gets priority=9.

### Flush Cron Endpoint

```
POST /api/cron/qbo-flush
  Secured: Authorization: Bearer CRON_SECRET
  Schedule (vercel.json): */5 * * * *  (every 5 minutes)

  Steps:
  1. Reset stale locks (processing > 120s → pending)
  2. Claim up to 30 pending jobs (ordered by priority ASC, nextRetryAt ASC)
  3. For each job: route to qbo-outbound.ts or qbo-inbound.ts by direction + entityType
  4. All 30 run sequentially (not parallel) to respect QBO rate limit (500 req/min per realm)
  5. Return { processed, failed, dead }
```

### Rate Limit Guard

QBO allows 500 requests/minute per realm. The flush cron runs every 5 minutes and claims 30 jobs. Each job averages 2-3 QBO API calls (GET SyncToken + POST). 30 jobs * 3 calls = 90 calls per 5-minute window — well within limits.

If an invocation receives a 429 from QBO, the error handler must:
1. Respect the Retry-After header
2. Immediately return the remaining unclaimed jobs to pending
3. Set their nextRetryAt to now() + Retry-After seconds

---

## Account Mapping

Before any financial transaction sync makes sense, users must configure which QBO Income/Expense/Asset accounts correspond to ServiceOps financial categories. The account mapping UI is a prerequisite to enabling invoice, item, expense, and time sync.

### Data Flow

```
Admin opens Settings > QuickBooks > Account Mapping
  |
  v
GET /api/integrations/qbo/accounts
  → qbo-client.ts: query("SELECT * FROM Account")
  → Returns list of QBO Accounts (Id, Name, AccountType, AccountSubType)
  |
  v
UI renders mapping form: ServiceOps category → QBO Account dropdown
  Categories: Labor Income, Parts/Materials Income, Travel Income,
              COGS - Labor, COGS - Materials, A/R Account, Tax Payable
  |
  v
POST /api/integrations/qbo/accounts  { mappings: [{category, qboAccountId}] }
  → Upsert QboAccountMap rows (one per category per org)
```

### Runtime Resolution

At sync time, `qbo-account-map.ts:resolveAccount(orgId, category)` queries the QboAccountMap table. If no mapping exists for a required category, the sync for that entity type fails with a clear error: "Account mapping required for 'Labor Income' before time activity sync can proceed."

This surfaces in the integration dashboard so admins know exactly what to configure before sync will work.

---

## CDC Polling Design

QBO's Change Data Capture endpoint returns all entities modified since a given timestamp in a single API call, making it far more efficient than polling individual entity endpoints.

### Endpoint

```
GET /v3/company/{realmId}/cdc
  ?entities=Customer,Invoice,Estimate,Item,Payment,Vendor,TimeActivity,Employee
  &changedSince=2026-03-07T00:00:00-07:00
  &minorversion=73
```

Returns a `CDCResponse.QueryResponse[]` — one array per entity type, each containing full entity objects that changed since the timestamp.

### Polling Schedule

```
vercel.json cron: "0 */4 * * *"  (every 4 hours)
  → POST /api/cron/qbo-cdc
```

4-hour interval is a practical default. It balances freshness against API call consumption. For orgs that need tighter payment status sync, the webhook handler provides near-real-time updates for the most critical events (Payment, Invoice).

### Processing Logic in qbo-cdc.ts

```typescript
export async function runCdcPoll(orgId: string, connection: QboConnection): Promise<CdcResult> {
  // 1. Load cursor (or use connection.connectedAt as baseline)
  const cursor = await prisma.qboCdcCursor.findUnique({ where: { orgId } });
  const changedSince = cursor?.lastPollAt ?? connection.connectedAt;

  // 2. Fetch all changes since cursor
  const cdcResponse = await qboCdcRequest(connection, changedSince, ENTITY_LIST);

  // 3. Route each changed entity to the appropriate inbound handler
  for (const queryResponse of cdcResponse.CDCResponse.QueryResponse) {
    for (const entity of queryResponse) {
      await routeCdcEntity(orgId, connection, entity);
    }
  }

  // 4. Advance cursor
  await prisma.qboCdcCursor.upsert({
    where: { orgId },
    create: { orgId, lastPollAt: new Date() },
    update: { lastPollAt: new Date() },
  });
}
```

### Conflict Resolution for Bidirectional Entities

For Customers and Items (synced both ways):

- Compare the QBO entity's `MetaData.LastUpdatedTime` against ServiceOps `qboSyncedAt`.
- If `LastUpdatedTime > qboSyncedAt` — QBO changed after our last push. Accept the QBO values, overwrite ServiceOps, update `qboSyncedAt`.
- If `LastUpdatedTime <= qboSyncedAt` — ServiceOps is newer. Skip the CDC update for this entity (our next outbound push will overwrite QBO).
- Log the decision in QboSyncLog with metadata: `{ winner: "qbo" | "serviceops", reason: "timestamp" }`.

This avoids infinite update loops where each system keeps re-overwriting the other.

---

## Error Handling Patterns

### Categorized Errors

All QBO API errors must be classified before deciding whether to retry:

| Error Class | HTTP Status | Action |
|---|---|---|
| Token expired | 401 | Refresh token, retry once immediately |
| Rate limited | 429 | Respect Retry-After, requeue with backoff |
| Entity not found | 404 | Mark job dead, log — likely a stale QBO ID |
| Validation error | 400 | Mark job dead — retrying will not fix a bad payload |
| QBO server error | 500/503 | Retry with backoff |
| Network timeout | — | Retry with backoff |
| SyncToken conflict | 400 (specific fault code) | Re-fetch SyncToken and retry once |

QBO returns structured fault objects in the response body even on 4xx. Parse `Fault.Error[0].code` before categorizing. Fault code `6140` = stale SyncToken — retry once with a fresh fetch.

### Idempotency

Every sync function must be safe to call multiple times for the same entity:

- Check `qboEntityId` on the local record before creating. If present, issue an update not a create.
- Use QBO `docNumber` as a natural key where possible — QBO rejects duplicate docNumbers, which serves as a safety net.
- Write QboSyncLog with `action + entityId + qboEntityId`. Duplicate log rows are acceptable — do not use them to drive idempotency logic.

---

## Build Order

Dependencies flow downward. Each phase produces outputs consumed by the next.

```
Phase 1 — Foundation (no dependencies on new features)
  1a. Add Prisma models: QboSyncJob, QboAccountMap, QboCdcCursor
      Add fields to: Quote, Material, LaborRate, Visit, Vendor
      Run migration.
  1b. Write qbo-types.ts — all TypeScript interfaces for QBO entities
  1c. Write qbo-mapper.ts — pure mapping functions, no I/O
  1d. Write qbo-queue.ts — enqueue/claim/done/fail helpers
      Depends on: 1a (QboSyncJob model)

Phase 2 — Core Client Extensions (depends on Phase 1)
  2a. Extend qbo-client.ts:
      - Add qboRequest() overload that parses QBO Fault objects
      - Add batchRequest(operations[]) for up to 30 ops
      - Add queryEntities(sql) for QBO SQL queries (accounts, items)
      - Add cdcRequest(changedSince, entities[])
      - Add voidInvoice(), sendInvoiceEmail(), createCreditMemo()
      Depends on: 1b (types)

Phase 3 — Account Mapping (must exist before financial syncs)
  3a. Write qbo-account-map.ts
  3b. Add GET + POST /api/integrations/qbo/accounts route
  3c. Build Account Mapping UI in Settings > QuickBooks
      Depends on: 1a (QboAccountMap model), 2a (queryEntities)

Phase 4 — Outbound Sync (depends on Phases 1-3)
  4a. Write qbo-outbound.ts — all push functions
      syncCustomer (refactored from qbo-sync.ts)
      syncInvoice (refactored from qbo-sync.ts)
      syncEstimate (quote → QBO Estimate)
      syncItem (material/labor rate → QBO Item)
      syncEmployee (tech → QBO Employee)
      syncVendor
      syncTimeActivity (visit time entry → QBO TimeActivity)
      syncExpense (job expense → QBO Bill/Purchase)
      voidInvoice, createCreditMemo, sendInvoiceEmail
  4b. Extend /api/integrations/qbo/sync route to handle new entity types
  4c. Write POST /api/cron/qbo-flush (queue processor)
      Add to vercel.json: */5 * * * *
      Depends on: 1d (queue), 2a (client), 3a (account map), 4a (outbound)

Phase 5 — Inbound Sync (depends on Phase 4 foundation)
  5a. Write qbo-inbound.ts — all pull handlers
      pullPaymentStatus (invoice → PAID/PARTIAL)
      pullEstimateStatus (quote accepted/rejected)
      pullCustomers (CDC inbound)
      pullItems (material catalog from QBO)
      pullAccounts (for account mapping UI — already built in Phase 3)
  5b. Write qbo-cdc.ts — CDC poll engine
  5c. Add POST /api/cron/qbo-cdc route
      Add to vercel.json: 0 */4 * * *
      Depends on: 1a (cursor model), 2a (cdcRequest), 5a

Phase 6 — Webhook Completion (depends on Phase 5)
  6a. Write qbo-webhook.ts — full dispatcher replacing skeleton in qbo-sync.ts
      Routes Payment, Invoice, Customer, Estimate events to qbo-inbound.ts handlers
  6b. Rewire /api/integrations/qbo/webhook/route.ts to use qbo-webhook.ts
      Depends on: 5a (inbound handlers)

Phase 7 — Dashboard + Reports (depends on Phases 4-6)
  7a. Write GET /api/integrations/qbo/health
      Recent sync log, error counts, entity counts, last CDC poll time
  7b. Write GET /api/integrations/qbo/reports
      Proxy QBO Reports API: ProfitAndLoss, AgedReceivables, BalanceSheet
  7c. Build enhanced Integration Dashboard UI
      Tabs: Health | Account Mapping | Sync Log | Manual Triggers | Reports
      Depends on: all prior phases complete

Phase 8 — Recurring Invoice Templates (parallel to Phase 7)
  8a. Add RecurringInvoiceTemplate model to Prisma (links to QBO RecurringTransaction)
  8b. Sync maintenance contract schedules → QBO RecurringTransaction
  8c. UI for managing recurring templates
      Depends on: 4a (invoice sync foundation)
```

### Critical Path

The items that block everything else:

1. Prisma migration (Phase 1a) — blocks all Prisma model usage
2. qbo-types.ts (Phase 1b) — blocks qbo-mapper.ts and all sync modules
3. Account Mapping UI complete (Phase 3) — blocks financial transaction syncs from being meaningful in production
4. qbo-outbound.ts complete (Phase 4a) — blocks Phase 5 (nothing to write back to if outbound not working)
5. qbo-inbound.ts complete (Phase 5a) — blocks webhook dispatcher (Phase 6a)

### Files That Must Not Break

These existing files are called from production API routes. All refactoring must preserve their public function signatures or update all callers atomically:

- `src/lib/qbo/qbo-client.ts` — `getValidAccessToken`, `createCustomer`, `updateCustomer`, `createInvoice`, `verifyWebhookSignature`
- `src/lib/qbo/qbo-sync.ts` — `getActiveConnection`, `syncCustomerToQbo`, `syncInvoiceToQbo`
- `src/app/api/integrations/qbo/sync/route.ts` — calls both sync functions above
- `src/app/api/integrations/qbo/webhook/route.ts` — calls `handleQboPaymentWebhook`

The safest migration strategy: keep the existing public functions in qbo-sync.ts as thin wrappers that delegate to the new qbo-outbound.ts functions. Remove the wrappers only after all callers are updated to import from qbo-outbound.ts directly.

---

*Generated: 2026-03-07 | Scope: src/lib/qbo/ module expansion for 19-point QBO integration*
