# Phase 3: Core Outbound — Research

**Written:** 2026-03-09
**Requirements covered:** PAY-01, PAY-03, QUOT-01, QUOT-02, ITEM-01, ITEM-02, VEND-02, SYNC-03, SYNC-04, DASH-01, DASH-02, DASH-03, DASH-05

---

## Existing Code Analysis

### What is already built and usable without modification

**`src/lib/qbo/qbo-client.ts`**
- `qboRequest()` — all API calls route through this; already supports optional `contentType` override (needed for `sendInvoiceEmail`)
- `sendInvoiceEmail(connection, qboInvoiceId, sendTo?)` — complete, ready to call (PAY-03)
- `queryEntities<T>(connection, iql, entityName)` — ready for DisplayName collision queries (VEND-02)
- `batchRequest(connection, operations)` — available for batch item sync if needed
- `getInvoice(connection, qboInvoiceId)` — ready; returns full `QboInvoice` with `Balance` field
- `verifyWebhookSignature(payload, signature, token)` — ready; stays in place for Phase 3 webhook rewrite

**Missing from `qbo-client.ts` — must add:**
- `getPayment(connection, paymentId)` — needed for PAY-01 payment processing. Signature: `async function getPayment(connection, paymentId): Promise<QboPayment>`. Pattern matches existing `getCustomer`/`getInvoice`.
- `createItem(connection, itemData)` — create QBO Item (NonInventory or Service). No existing Item CRUD in client.
- `updateItem(connection, qboItemId, itemData)` — fetch-merge-POST pattern, same as `updateCustomer`.
- `getItem(connection, qboItemId)` — same GET pattern as `getCustomer`.
- `createEstimate(connection, estimateData)` — POST to `estimate` endpoint. Pattern matches `createInvoice`.
- `updateEstimate(connection, qboEstimateId, estimateData)` — fetch-merge-POST for updates.
- `getEstimate(connection, qboEstimateId)` — GET pattern.

**`src/lib/qbo/qbo-sync.ts`**
- `getActiveConnection(orgId)` — ready, used in every sync function
- `requireAccountMapping(orgId)` — ready, returns `{ complete, missing }`
- `getAccountMapping(orgId, category)` — returns `{ qboAccountId, qboAccountName, qboAccountType }`
- `syncCustomerToQbo(orgId, customerId)` — ready but needs VEND-02 collision handling retrofitted
- `syncInvoiceToQbo(orgId, invoiceId)` — exists but needs significant modification for ITEM-02 (ItemRef on lines) and QUOT-02 (LinkedTxn from estimate)
- `handleQboPaymentWebhook(payload)` — skeletal stub; the entire function body will be replaced by the thin dispatcher (SYNC-03)

**Missing from `qbo-sync.ts` — must add:**
- `getPayment(connection, paymentId)` re-exported or inline call for payment processing
- `syncMaterialToQbo(orgId, materialId)` — ITEM-01
- `syncLaborRateToQbo(orgId, laborRateId)` — ITEM-01
- `syncQuoteToQbo(orgId, quoteId)` — QUOT-01
- `resolveOrCreateQboEntity(...)` — VEND-02 collision helper (reusable)
- `processPaymentJob(orgId, qboPaymentId, realmId)` — PAY-01 payment fetch and invoice mark-paid logic

**`src/lib/qbo/qbo-mapper.ts`**
- `toQboCustomer(customer, existingQbo?)` — ready
- `toQboInvoice(invoice, lineItems, customerRef, existingQbo?)` — exists but `toQboInvoiceLine` currently only conditionally adds `ItemRef`. The caller (`syncInvoiceToQbo`) never passes `itemRef` today. No mapper change needed — the sync function needs to populate `itemRef` per line before calling the mapper.
- `toQboInvoiceLine(item, itemRef?)` — ready, `ItemRef` slot already designed in (line 148-152 of mapper). Just needs the caller to pass the QBO item ID.
- `toQboEstimate(quote, lineItems, customerRef, existingQbo?)` — ready. Line items do NOT yet include `ItemRef`. Same fix needed as invoices: caller must resolve item IDs first.
- `roundQboAmount(value)` — ready

**Missing from `qbo-mapper.ts` — must add:**
- `toQboItem(source, type, incomeAccountRef, existingQbo?)` — maps Material or LaborRate to a QBO Item payload. `type` is `"NonInventory"` for materials, `"Service"` for labor rates.

**`src/lib/qbo/qbo-types.ts`**
All types needed for Phase 3 are already defined:
- `QboPayment` (line 182) — has `Line[].LinkedTxn`, `TxnDate`, `PaymentMethodRef`, `TotalAmt`
- `QboItem` (line 229) — has `Name`, `Type`, `IncomeAccountRef`, `ExpenseAccountRef`, `UnitPrice`
- `QboEstimate` (line 200) — has `LinkedTxn`, `ExpirationDate`, `TxnStatus`
- `QboLinkedTxn` (line 43) — `{ TxnId, TxnType, TxnLineId? }`, ready for QUOT-02

**`src/lib/qbo/qbo-queue.ts`**
All operations are complete: `enqueue`, `claimBatch`, `complete`, `fail`, `resetStaleLocks`, `getDeadLetters`, `requeueDeadLetter`. No changes needed to this file.

### Existing webhook route

`src/app/api/integrations/qbo/webhook/route.ts` — currently calls `handleQboPaymentWebhook(payload)` which processes inline (blocking). The entire POST handler body must be rewritten as a thin dispatcher. The GET handler (webhook verification) stays as-is.

### Existing invoice detail page

`src/app/(app)/invoices/[id]/page.tsx` — the Actions card (line 255-304) already has Edit, Download PDF, Print, and Email to Customer buttons. A new "Send via QBO" button will be added to this block. The Invoice type definition at the top of the file needs `qboInvoiceId: string | null` added so the button can be conditionally shown.

### Existing sync route

`src/app/api/integrations/qbo/sync/route.ts` — handles `customers` and `invoices` entity types via inline sync. For Phase 3, this route will be extended to accept `items`, `estimates` entity types. The health dashboard manual trigger will call a separate new endpoint rather than this route.

### Prisma schema — critical gap for ItemRef resolution

The `InvoiceLineItem` model has:
- `materialUsageId String? @db.Uuid` — links to `TaskMaterialUsage`
- `taskId String? @db.Uuid` — links to `TaskInstance`
- No direct `materialId` field
- No `laborRateId` field

The `TaskMaterialUsage` model has `materialId String? @db.Uuid` — the optional link to the Material catalog.

To resolve an `ItemRef` for an invoice line item, the lookup chain for MATERIAL type lines is:
```
InvoiceLineItem.materialUsageId → TaskMaterialUsage.materialId → Material.qboItemId
```

For LABOR type lines there is no equivalent chain — there is no `laborRateId` on `InvoiceLineItem`. The decision is: for LABOR lines, use the org's default or named labor rate Item. The implementation must handle both cases: lines with a resolvable material chain (use that item's `qboItemId`) and lines without (fall back to the most appropriate service item from account mapping).

The `QuoteLineItem` model has `materialId String? @db.Uuid` — a direct link to Material. This is simpler to resolve for estimate sync.

---

## Schema Changes Needed

### QboSyncJob — add two fields for webhook dedup (SYNC-04)

The current `QboSyncJob` model has no fields to identify the QBO-side entity for webhook-originated jobs. The dedup check requires knowing (entityType + qboEntityId + action) to find an already-queued job.

```prisma
model QboSyncJob {
  // ... existing fields ...
  qboEntityId  String?   // QBO entity ID (for webhook-originated jobs, dedup)
  qboRealmId   String?   // QBO realm ID (for webhook-originated jobs)
}
```

Migration name: `add_qbo_sync_job_dedup_fields`

The existing index `@@index([orgId, entityType, entityId, status])` covers dedup queries when `entityId` is the ServiceOps entity ID. For webhook dedup (where we only know the QBO entity ID, not the ServiceOps entity ID), a new index is needed:

```prisma
@@index([qboEntityId, entityType, status])
```

No other schema changes are required. All other fields (`qboItemId` on Material and LaborRate, `qboEstimateId` + `qboSyncedAt` on Quote) already exist from Phase 1 FOUND-06.

### Confirm: all FOUND-06 fields are present

| Model | Field | Status |
|-------|-------|--------|
| Material | `qboItemId String?` | Present (line 1056) |
| LaborRate | `qboItemId String?` | Present (line 1302) |
| Quote | `qboEstimateId String?` | Present (line 1210) |
| Quote | `qboSyncedAt DateTime?` | Present (line 1211) |
| Invoice | `qboInvoiceId String?` | Present (line 1349) |
| Invoice | `qboSyncedAt DateTime?` | Present (line 1350) |
| QboConnection | `refreshTokenExpiry DateTime?` | Present (line 1716) |

All FOUND-06 fields confirmed. No schema additions needed beyond the two QboSyncJob dedup fields.

---

## Implementation Patterns

### Pattern 1: Sync function structure (established in Phase 1)

Every sync function in `qbo-sync.ts` follows this exact pattern. New functions for Phase 3 must follow it:

```typescript
export async function syncXxxToQbo(
  orgId: string,
  entityId: string
): Promise<{ success: boolean; qboEntityId?: string; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) return { success: false, error: "No active QBO connection" };

  const entity = await prisma.xxx.findFirst({ where: { id: entityId, orgId } });
  if (!entity) return { success: false, error: "Entity not found" };

  try {
    // ... sync logic ...
    await prisma.qboSyncLog.create({ data: { orgId, connectionId: connection.id, entityType: "xxx", entityId, qboEntityId, action: "push", status: "success" } });
    return { success: true, qboEntityId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await prisma.qboSyncLog.create({ data: { orgId, connectionId: connection.id, entityType: "xxx", entityId, action: "push", status: "failed", errorMessage } });
    return { success: false, error: errorMessage };
  }
}
```

### Pattern 2: Fetch-merge-POST for updates (FOUND-02)

All update functions fetch the full entity from QBO first, spread it as the base, then override only ServiceOps-managed fields. This pattern is established in `updateCustomer` and `toQboCustomer`. Apply it to `updateItem` and `updateEstimate`.

### Pattern 3: Account mapping gate (established in Phase 2)

Financial syncs (invoice, item) call `requireAccountMapping(orgId)` before proceeding. Items need income accounts from mapping — `materials_income` for NonInventory, `labor_income` for Service type.

```typescript
const accountMapping = await requireAccountMapping(orgId);
if (!accountMapping.complete) {
  return { success: false, error: `Account mapping required — configure in QBO Settings. Missing: ${accountMapping.missing.join(", ")}`, missingCategories: accountMapping.missing };
}
const incomeMapping = await getAccountMapping(orgId, "materials_income"); // or labor_income
```

### Pattern 4: Cron route with CRON_SECRET (established in generate-pms)

The qbo-flush cron route must match the exact pattern:
```typescript
const authHeader = req.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

And `vercel.json` entry:
```json
{ "path": "/api/cron/qbo-flush", "schedule": "*/5 * * * *" }
```

### Pattern 5: resolveOrCreateQboEntity (new, reusable)

This helper implements the VEND-02 collision check for all named entity creates:

```typescript
async function resolveOrCreateQboEntity<T extends { Id: string }>(
  connection: QboConnection,
  entityType: string,       // "Customer" | "Item"
  displayName: string,
  matchFn: (existing: T) => boolean,  // determines if existing QBO entity is the same record
  createFn: () => Promise<T>           // calls createCustomer / createItem etc.
): Promise<{ entity: T; wasExisting: boolean }>
```

Steps inside:
1. `queryEntities<T>(connection, \`SELECT * FROM ${entityType} WHERE DisplayName = '${displayName}'\`, entityType)`
2. If results exist: run `matchFn` on each. If a match is found, return it with `wasExisting: true`.
3. If collision but no match: retry `createFn` with `displayName + " (SvcOps)"`.
4. If no collision: call `createFn()` normally.

### Pattern 6: Queue flush dispatcher

The cron processes jobs sequentially (not parallel) to avoid QBO rate limit (500 req/min, but burst limits apply per entity type):

```typescript
for (const job of claimed) {
  try {
    await dispatchJob(job);
    await complete(job.id);
  } catch (err) {
    await fail(job.id, err instanceof Error ? err.message : String(err));
  }
}
```

The `dispatchJob` function is a switch on `job.entityType + ":" + job.action`:
- `"customer:push"` → `syncCustomerToQbo(job.orgId, job.entityId)`
- `"invoice:push"` → `syncInvoiceToQbo(job.orgId, job.entityId)`
- `"invoice:email"` → `syncInvoiceEmailToQbo(job.orgId, job.entityId)`
- `"item:push"` — dispatch based on `job.payload.sourceType` ("material" or "laborRate")
- `"estimate:push"` → `syncQuoteToQbo(job.orgId, job.entityId)`
- `"payment:pull"` → `processPaymentJob(job.orgId, job.payload.qboPaymentId, job.payload.realmId)`

### Pattern 7: API route structure (established project-wide)

```typescript
export async function POST(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId, userId, role } = authResult.auth;
  // ... body ...
  return NextResponse.json({ data: result });
}
```

---

## Risk Areas

### Risk 1: InvoiceLineItem has no direct Material or LaborRate FK — ItemRef resolution is non-trivial

The `InvoiceLineItem.materialUsageId` chain is optional at every step. An invoice line item may have:
- `materialUsageId` set → `TaskMaterialUsage.materialId` set → `Material.qboItemId` set (best case, full chain)
- `materialUsageId` set → `TaskMaterialUsage.materialId` null (ad-hoc material usage, no catalog link)
- `materialUsageId` null (line item added manually, no task link)
- `itemType = LABOR` with no labor rate FK at all

For ITEM-02, the strategy must handle all these cases gracefully:
- Full chain resolves: use `Material.qboItemId` as ItemRef
- Chain breaks or absent: cascade-sync the material if possible; if no Material record exists, no ItemRef can be set
- LABOR lines: require a new approach — either a catch-all "Labor" service item per org, or the named LaborRate linked via description matching

**Decision needed in planning:** Should `InvoiceLineItem` get a `materialId String? @db.Uuid` direct field (cleaner resolution) or should the chain-traversal be the implementation? Given that `QuoteLineItem` already has a direct `materialId`, and the chain approach adds complexity, adding `materialId String? @db.Uuid` and `laborRateId String? @db.Uuid` to `InvoiceLineItem` would be the cleaner long-term solution. However, this requires a migration and re-evaluation of the ITEM-02 approach. The CONTEXT.md says ItemRef should be resolved by checking line items' "linked materials/labor rates" — the context implies these links exist. This is a schema gap to flag in planning.

**Recommended mitigation:** For v1 Phase 3, query the chain via `materialUsageId → TaskMaterialUsage.materialId → Material.qboItemId`. For lines where the chain is absent or breaks, log a warning in QboSyncLog metadata and proceed without ItemRef on that line (better than blocking the entire invoice sync). This is a partial fix that covers the common case (WO-generated invoices).

### Risk 2: QBO rate limits during cascade sync

When syncing an invoice that has 20 line items, each backed by a different material that has never been synced, that is 20 sequential QBO Item create calls followed by the Invoice create — 21 API calls in a single function. QBO's rate limit is 500 requests per minute, but burst behavior can trigger throttling. The `qboRequest` function does not currently have retry-with-backoff logic.

**Recommended mitigation:** Use `batchRequest()` to batch up to 30 Item creates in a single API call. The `batchRequest` function is already built. The mapper must produce the batch operation format for each item.

### Risk 3: Estimate sync trigger condition

`syncQuoteToQbo` should only trigger when quote status is SENT or APPROVED (per CONTEXT). However, the cron queue flush will process whatever jobs are enqueued. The enqueue caller (likely the quote status-change API route) is responsible for only enqueueing when status transitions to SENT/APPROVED. This is an integration point that is easy to miss during implementation.

**Recommended mitigation:** Add a guard inside `syncQuoteToQbo` itself: if `quote.status` is not SENT or APPROVED, return early with a descriptive error rather than creating a DRAFT estimate in QBO.

### Risk 4: Webhook 50ms return requirement

The current webhook handler calls `handleQboPaymentWebhook` which does multiple DB queries (find connection, create sync log for each entity) before returning 200. The new thin dispatcher must only do: signature verify → JSON parse → for each entity in payload → one DB insert to QboSyncJob. The risk is that the dedup check (`findFirst` on QboSyncJob) adds latency for payloads with many entities.

**Recommended mitigation:** Run the dedup checks with `findMany` in a single query for all (entityType, qboEntityId) pairs in the payload, rather than one `findFirst` per entity. This reduces N DB round-trips to 1.

### Risk 5: `sendInvoiceEmail` QBO daily email limit

QBO enforces a daily email limit per realmId (undocumented but observed in production at ~100/day). The "Send via QBO" button on the invoice detail page could be clicked multiple times.

**Recommended mitigation:** After a successful send, update a `qboEmailedAt DateTime?` field on Invoice — or use the existing `EmailStatus` field that QBO returns on the invoice after send. The invoice detail page should disable the button and show "Sent via QBO on [date]" once emailed. However, `Invoice` has no `qboEmailedAt` field. For v1, show the QBO email status from the invoice's `qboSyncedAt` or via a separate field. Flag this in planning: may need `qboEmailedAt DateTime?` on Invoice model, or simply use the QBO invoice `EmailStatus` field returned from `sendInvoiceEmail`.

### Risk 6: LinkedTxn for estimate-to-invoice requires quote to be synced first

If a user converts a quote to an invoice but never synced the quote to QBO as an estimate, `syncInvoiceToQbo` must auto-sync the quote first. But `syncQuoteToQbo` itself requires the customer to be synced. This creates a three-level cascade:

```
syncInvoiceToQbo
  → (if quoteId and no qboEstimateId) syncQuoteToQbo
    → (if no qboCustomerId) syncCustomerToQbo
      → (if materials) syncMaterialToQbo × N
```

This is manageable but must be explicitly documented in the implementation plan so the developer accounts for error propagation at each level.

### Risk 7: Health dashboard aggregate queries could be slow

The `GET /api/integrations/qbo/health` endpoint needs to aggregate counts from `QboSyncJob` and `QboSyncLog` by entityType and status. These tables could have thousands of rows for active orgs. Unindexed aggregation queries will be slow.

**Recommended mitigation:** The existing index `@@index([orgId, entityType])` on `QboSyncLog` and `@@index([orgId, status, priority])` on `QboSyncJob` cover the needed queries. Use `groupBy` or multiple `count` calls with `where` filters rather than loading all rows.

---

## Dependency Graph

The implementation must respect these ordering constraints:

### Wave 1 — Foundation (no dependencies on other Phase 3 work)

1. **Schema migration** — add `qboEntityId` and `qboRealmId` to QboSyncJob. Must be first because the webhook rewrite and queue flush both need these fields.

2. **`getPayment` in qbo-client.ts** — needed by payment job processor. Add alongside `createItem`, `updateItem`, `getItem`, `createEstimate`, `updateEstimate`, `getEstimate` to avoid multiple client touches.

3. **`toQboItem` in qbo-mapper.ts** — pure function, no dependencies.

4. **`resolveOrCreateQboEntity` helper** — reusable by item sync and customer sync retrofit. Must exist before any sync functions that use it.

### Wave 2 — Sync functions (depend on Wave 1)

5. **`syncMaterialToQbo` + `syncLaborRateToQbo`** (ITEM-01) — depend on `toQboItem`, `createItem`, `getItem`, `resolveOrCreateQboEntity`.

6. **`syncCustomerToQbo` retrofit** (VEND-02) — add collision check to existing function. Depends on `resolveOrCreateQboEntity`.

7. **`syncQuoteToQbo`** (QUOT-01) — depends on `syncCustomerToQbo` (auto-cascade), `syncMaterialToQbo` (cascade for line ItemRefs), `createEstimate`.

8. **`syncInvoiceToQbo` modification** (ITEM-02, QUOT-02) — modify existing function to (a) resolve ItemRef per line via materialUsageId chain, (b) cascade-sync missing materials/labor rates, (c) add LinkedTxn when quote has `qboEstimateId`. Depends on `syncMaterialToQbo`, `syncQuoteToQbo`.

9. **`processPaymentJob`** (PAY-01) — depends on `getPayment` from qbo-client. Standalone — no dependencies on items/estimates.

### Wave 3 — API routes (depend on Wave 2 sync functions)

10. **Webhook rewrite** (SYNC-03, SYNC-04) — thin dispatcher using `enqueue`. Depends on schema migration (needs `qboEntityId`/`qboRealmId` fields on enqueued job).

11. **`POST /api/integrations/qbo/send-invoice-email`** (PAY-03) — depends on `sendInvoiceEmail` (already in qbo-client), needs invoice lookup.

12. **`GET /api/integrations/qbo/health`** and **`GET /api/integrations/qbo/sync-logs`** (DASH-01, DASH-02) — pure DB query endpoints, no sync function dependencies.

13. **`POST /api/integrations/qbo/sync-trigger`** (DASH-03) — calls enqueue for manual triggers. Depends on Wave 2 sync functions being in place (or can call them directly for immediate mode).

14. **`GET /api/cron/qbo-flush`** (DASH-05) — depends on all Wave 2 sync functions + `processPaymentJob`. This is the most complex route.

### Wave 4 — UI (depend on Wave 3 API routes)

15. **"Send via QBO" button** on invoice detail page (PAY-03 UI) — depends on `POST /api/integrations/qbo/send-invoice-email`.

16. **`/settings/integrations/qbo-health` page** (DASH-01, DASH-02, DASH-03) — depends on health, sync-logs, and sync-trigger API routes.

17. **Sidebar + settings page links** for QBO health.

18. **`vercel.json` qbo-flush cron entry** (DASH-05) — add alongside existing PM cron.

---

## Validation Architecture

Each requirement gets a specific, verifiable test. "Verifiable" means either a Vitest unit test, a Playwright integration test, or a documented manual QBO sandbox test.

### PAY-01 — Payment receipt processing

**Unit test (Vitest):** Mock `getPayment` to return a `QboPayment` with `Line[0].LinkedTxn = [{ TxnId: "qbo-inv-123", TxnType: "Invoice" }]` and `TxnDate = "2026-03-09"`. Call `processPaymentJob`. Assert that `prisma.invoice.update` was called with `{ status: "PAID", paidAt: new Date("2026-03-09") }` on the invoice that has `qboInvoiceId = "qbo-inv-123"`.

**Partial payment test:** Mock QBO invoice `Balance > 0` after payment. Assert invoice status is NOT changed to PAID. Assert QboSyncLog entry was created with metadata containing partial payment info.

**Integration test:** In QBO sandbox, create a payment against a test invoice. Fire the webhook payload manually via `POST /api/integrations/qbo/webhook`. Observe that a `payment:pull` job appears in QboSyncJob. Run the cron endpoint. Assert invoice status becomes PAID in the database.

### PAY-03 — Invoice email via QBO

**Unit test:** Mock `sendInvoiceEmail` to return a `QboInvoice` with `EmailStatus = "EmailSent"`. Call the API endpoint `POST /api/integrations/qbo/send-invoice-email` with a valid `invoiceId`. Assert 200 response with success message.

**Error case test:** Call endpoint with `invoiceId` for an invoice that has no `qboInvoiceId`. Assert 400 response with message "Invoice must be synced to QBO before sending via QBO email".

**Manual QBO validation:** After triggering, check QBO sandbox for the invoice — it should show EmailStatus = EmailSent.

### ITEM-01 — Item/Service sync

**Unit test (mapper):** Call `toQboItem(material, "NonInventory", { value: "income-acct-id" })`. Assert `{ Type: "NonInventory", Name: material.name, IncomeAccountRef: { value: "income-acct-id" }, UnitPrice: <rounded unitCost> }`.

**Unit test (sync):** Mock `createItem` to return `{ Id: "qbo-item-123" }`. Call `syncMaterialToQbo(orgId, materialId)`. Assert `prisma.material.update` called with `{ qboItemId: "qbo-item-123" }`. Assert success QboSyncLog entry created.

**Update path test:** For material already having `qboItemId`, assert `getItem` is called to fetch existing, `updateItem` is called with merged payload (not `createItem`).

### ITEM-02 — ItemRef on invoice lines

**Integration unit test:** Create invoice with 2 line items — one MATERIAL type with `materialUsageId → materialId → qboItemId = "item-1"`, one LABOR type with no chain. Call `syncInvoiceToQbo`. Assert the QBO invoice payload sent to `createInvoice` has `Line[0].SalesItemLineDetail.ItemRef = { value: "item-1" }`. Assert `Line[1]` has no `ItemRef` (labor line with no resolvable ID, graceful degradation).

**Cascade test:** Material has `qboItemId = null` when invoice sync starts. Assert `syncMaterialToQbo` is called before invoice is created. Assert final invoice payload has ItemRef populated.

### VEND-02 — DisplayName collision handling

**Unit test:** Mock `queryEntities` to return an existing QBO Customer with same DisplayName and matching email. Call `resolveOrCreateQboEntity`. Assert `createCustomer` is NOT called. Assert returned entity is the existing one.

**Collision with no match test:** Mock `queryEntities` to return QBO Customer with same DisplayName but different email. Assert `createCustomer` IS called with DisplayName = `"Original Name (SvcOps)"`.

**No collision test:** Mock `queryEntities` to return empty array. Assert `createCustomer` called with original DisplayName.

### QUOT-01 — Estimate/Quote sync

**Unit test:** Mock `createEstimate` to return `{ Id: "qbo-est-456" }`. Call `syncQuoteToQbo` with a SENT quote. Assert `prisma.quote.update` called with `{ qboEstimateId: "qbo-est-456", qboSyncedAt: <now> }`.

**Status guard test:** Call `syncQuoteToQbo` with a DRAFT quote. Assert returns `{ success: false, error: "..." }` without calling QBO API.

**ExpirationDate test:** Quote with `validUntil = new Date("2026-04-30")` produces QBO Estimate with `ExpirationDate = "2026-04-30"`.

### QUOT-02 — Estimate-to-Invoice conversion (LinkedTxn)

**Unit test:** Invoice has `quoteId = "quote-1"`. Quote has `qboEstimateId = "est-789"`. Call `syncInvoiceToQbo`. Assert the payload passed to `createInvoice` includes `LinkedTxn = [{ TxnId: "est-789", TxnType: "Estimate" }]`.

**No quote test:** Invoice has no `quoteId`. Assert `LinkedTxn` is absent from invoice payload.

**Quote not yet synced test:** Invoice has `quoteId` but quote has `qboEstimateId = null`. Assert `syncQuoteToQbo` is called first, then invoice payload includes `LinkedTxn` with the newly created estimate ID.

### SYNC-03 — Webhook thin dispatcher

**Response time test (manual):** Hit `POST /api/integrations/qbo/webhook` with a valid signed payload containing 3 entity events. Measure response time — must be under 200ms (well within the 50ms target after removing inline QBO calls).

**Unit test:** Mock `prisma.qboSyncJob.create`. Call POST webhook with payload containing `Payment` create, `Invoice` update, `Customer` update events. Assert `enqueue` was called 3 times with correct `entityType`, `qboEntityId`, `action` values. Assert no QBO API calls were made.

**Signature verification test:** Call with invalid `intuit-signature`. Assert 401 response.

**Malformed payload test:** Call with invalid JSON. Assert 200 response (never return non-200 to QBO).

### SYNC-04 — Webhook idempotency

**Dedup test:** Enqueue a `payment:pull` job for `qboEntityId = "pay-123"` with status `pending`. Receive a second webhook event for the same payment. Assert no second job is created (dedup check prevents it). Assert `enqueue` was called only once.

**Dedup bypass test:** After the first job reaches `completed` status, receive the same webhook event again. Assert a NEW job IS created (completed jobs should not block re-processing of new events for the same entity).

### DASH-01 — Integration health dashboard (connection status + overview)

**Manual validation:** Navigate to `/settings/integrations/qbo-health`. Assert page shows:
- Company name and realm ID from QboConnection
- Token expiry countdown (days remaining)
- Stat cards for each entity type showing last sync time and pending/failed/success counts

**API unit test:** Mock QboSyncJob and QboSyncLog counts. Call `GET /api/integrations/qbo/health`. Assert response shape: `{ connection: {...}, entityStats: { customer: { pending, failed, success, lastSync }, ... } }`.

### DASH-02 — Sync error log with resolution hints

**Unit test:** Create QboSyncLog entries with `status = "failed"` and various `errorMessage` values including "Business Validation Error" and "Stale Object Error". Call `GET /api/integrations/qbo/sync-logs?status=failed`. Assert response includes `resolutionHint` field per entry.

**Resolution hint map test:** Assert known QBO error substrings map to actionable hint strings (not raw error messages).

### DASH-03 — Manual sync triggers

**API test:** Call `POST /api/integrations/qbo/sync-trigger` with `{ entityType: "customers" }`. Assert QboSyncJob entries are created for all unsynced customers in the org. Assert `{ enqueued: N }` in response.

**Permission test:** Call as TECH role (not ADMIN). Assert 403.

### DASH-05 — Queue flush cron

**Unit test:** Mock `claimBatch` to return 3 jobs of different types. Mock the sync functions. Assert all 3 are dispatched to the correct sync function. Assert `complete` is called for successful jobs. Assert `fail` is called when a sync function throws.

**Sequential processing test:** Assert jobs are processed one at a time (not parallel Promise.all). Verify by checking execution order in mocked calls.

**Summary response test:** Assert response JSON includes `{ processed, succeeded, failed, deadLettered, resetStale }` counts.

**Vercel cron auth test:** Call without `Authorization: Bearer <CRON_SECRET>`. Assert 401.

---

*Research written: 2026-03-09*
*Phase: 03-core-outbound*
