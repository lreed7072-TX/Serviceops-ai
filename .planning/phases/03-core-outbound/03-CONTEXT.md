# Phase 3: Core Outbound - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the table-stakes integration features: payment receipt processing, item/service sync (with correct ItemRef on invoices), estimate/quote sync with LinkedTxn conversion, invoice email via QBO, webhook idempotency rewrite, queue flush cron, and the integration health dashboard with error log and manual sync triggers.

Requirements: PAY-01, PAY-03, QUOT-01, QUOT-02, ITEM-01, ITEM-02, VEND-02, SYNC-03, SYNC-04, DASH-01, DASH-02, DASH-03, DASH-05

</domain>

<decisions>
## Implementation Decisions

### Payment Receipt Processing (PAY-01)
- Current `handleQboPaymentWebhook()` is skeletal — just logs events, never actually marks invoices PAID
- New flow: webhook enqueues a `payment:pull` job → cron picks it up → fetches QBO Payment entity via `getPayment()` → extracts `Line[].LinkedTxn` to find invoice references → matches by `qboInvoiceId` on ServiceOps Invoice → marks PAID
- When QBO Payment has Balance=0 on the linked invoice: set `invoice.status = 'PAID'`, `invoice.paidAt = paymentDate`
- Partial payments: Invoice model has no partial payment amount field — for v1, only mark PAID when QBO invoice `Balance === 0`. Log partial payments in QboSyncLog metadata for dashboard visibility
- Payment method: Extract from QBO Payment's `PaymentMethodRef` and store in QboSyncLog metadata (no schema change needed)
- New QBO client function needed: `getPayment(connection, paymentId)` to fetch payment details
- New QBO type needed: `QboPayment` interface (already defined in qbo-types.ts from Phase 1)

### Invoice Email via QBO (PAY-03)
- `sendInvoiceEmail()` already exists in qbo-client.ts from Phase 2
- New API endpoint: `POST /api/integrations/qbo/send-invoice-email` — takes `invoiceId`, looks up `qboInvoiceId`, calls `sendInvoiceEmail()`
- Add a "Send via QBO" action button on the invoice detail page (alongside existing actions)
- Requires invoice to be synced to QBO first (has `qboInvoiceId`) — return error if not synced
- Optional email override: if customer has a different billing email, pass it via `sendTo` param

### Item/Service Sync (ITEM-01)
- Materials → QBO Item (type: `NonInventory` for parts, `Inventory` for tracked items — use `NonInventory` for all since QBO inventory tracking adds complexity we don't need)
- LaborRate → QBO Item (type: `Service`)
- Both use income account from account mapping: materials use `materials_income`, labor rates use `labor_income`
- New mapper functions in `qbo-mapper.ts`: `toQboItem(material | laborRate, accountMapping)` — returns QBO Item payload
- New sync functions in `qbo-sync.ts`: `syncMaterialToQbo(orgId, materialId)`, `syncLaborRateToQbo(orgId, laborRateId)`
- Create or update pattern: check `qboItemId` — if null, create (with DisplayName collision check per VEND-02); if set, fetch+merge+update
- Store `qboItemId` on Material/LaborRate after successful sync (fields already exist from Phase 1)

### ItemRef on Invoice Lines (ITEM-02)
- Every synced invoice line item MUST reference a valid QBO Item via `ItemRef: { value: qboItemId }`
- Before syncing an invoice: check all line items' linked materials/labor rates have `qboItemId`
- If any material/labor rate lacks `qboItemId`: auto-sync it to QBO first (cascade sync)
- Modify `syncInvoiceToQbo()` to:
  1. Gather all unique materialIds from line items
  2. Check which lack `qboItemId`
  3. Sync missing items first (batch if possible, sequential fallback)
  4. Build invoice lines with `ItemRef` from the now-populated `qboItemId`
- This fixes the live bug of revenue posting to Uncategorized Income

### DisplayName Collision Handling (VEND-02)
- Before creating ANY named entity in QBO (Customer, Item), query first via `queryEntities()` with `SELECT * FROM [Entity] WHERE DisplayName = '...'`
- If collision found: append ` (SvcOps)` suffix to DisplayName
- If collision found AND the QBO entity looks like the same record (matching email for customer, matching name for item): link to existing by storing the QBO entity's Id — don't create a duplicate
- Matching heuristic: for Customers, match on `PrimaryEmailAddr`; for Items, match on `Name` + `Type`
- New helper: `resolveOrCreateQboEntity(connection, entityType, displayName, matchFn, createPayload)` — reusable for all named entities
- Apply to: `syncCustomerToQbo()` (retrofit), `syncMaterialToQbo()`, `syncLaborRateToQbo()`

### Estimate/Quote Sync (QUOT-01)
- Push ServiceOps Quote → QBO Estimate when quote status is SENT or APPROVED
- New mapper: `toQboEstimate(quote, lineItems, customerQboId, accountMapping)` in qbo-mapper.ts
- New sync function: `syncQuoteToQbo(orgId, quoteId)` in qbo-sync.ts
- Maps QuoteLineItems to QBO Estimate Line items with ItemRef (sync items first if needed)
- Customer must be synced first (auto-sync if no `qboCustomerId`)
- Store `qboEstimateId` + `qboSyncedAt` on Quote after sync (fields already exist)
- Estimate TxnDate = quote.createdAt, ExpirationDate = quote.validUntil

### Estimate-to-Invoice Conversion (QUOT-02)
- When converting a synced quote to invoice: create QBO Invoice with `LinkedTxn` referencing the QBO Estimate
- LinkedTxn format: `[{ TxnId: qboEstimateId, TxnType: "Estimate" }]`
- Modify `syncInvoiceToQbo()`: if the invoice has a `quoteId` AND that quote has a `qboEstimateId`, include LinkedTxn
- This creates the QBO audit trail: Estimate → Invoice
- If quote was NOT synced as estimate: sync it first, then create linked invoice

### Webhook Dispatcher Rewrite (SYNC-03, SYNC-04)
- Current webhook processes inline (blocks until QBO API calls complete)
- New flow: validate signature → parse payload → deduplicate → enqueue to QboSyncJob → return 200 immediately
- Target: return 200 within 50ms (just DB insert, no QBO API calls)
- Deduplication (SYNC-04): Before enqueueing, check for existing job with matching (entityType, qboEntityId, action) that is pending/claimed — skip if found
- Add new fields to QboSyncJob if needed: `qboEntityId String?`, `qboRealmId String?` for webhook-originated jobs
- Webhook route handler becomes thin: signature check → JSON parse → for each entity event → dedup check → enqueue → return 200
- Processing moved entirely to the queue flush cron (DASH-05)
- Handle all entity types the webhook might send: Payment, Invoice, Customer, Item, Estimate

### Integration Health Dashboard (DASH-01, DASH-02, DASH-03)
- New page: `/settings/integrations/qbo-health` (linked from integrations page)
- Sections:
  1. **Connection Status** — connected/disconnected, company name, realm ID, token expiry countdown
  2. **Sync Overview** — cards showing last sync time per entity type (Customer, Invoice, Item, Estimate, Payment), with pending/failed/success counts from QboSyncJob + QboSyncLog
  3. **Error Log** — filterable table of QboSyncLog entries with status=failed, showing entity type, error message, timestamp, and resolution hint
  4. **Manual Sync Triggers** — buttons to trigger sync for each entity type (Sync All Customers, Sync All Invoices, etc.)
- Resolution hints: map common QBO error codes to actionable messages (e.g., "Business Validation Error" → "Check required fields in QBO", "Stale Object" → "Record was modified in QBO — re-sync")
- Re-trigger button per error: re-enqueue the failed sync job
- API endpoints:
  - `GET /api/integrations/qbo/health` — aggregated health data
  - `GET /api/integrations/qbo/sync-logs` — paginated error log
  - `POST /api/integrations/qbo/sync-trigger` — manual sync trigger (by entity type)
- Design: follows existing page patterns — card layout, stat bars, table with filters, orange action buttons

### Queue Flush Cron (DASH-05)
- New cron route: `GET /api/cron/qbo-flush`
- Schedule: every 5 minutes (`*/5 * * * *`)
- Add to `vercel.json` alongside existing PM cron
- Security: same CRON_SECRET bearer token pattern as generate-pms
- Processing flow:
  1. `resetStaleLocks(120)` — clear stuck jobs
  2. `claimBatch(30)` — claim up to 30 pending jobs
  3. For each claimed job: dispatch to appropriate sync function based on entityType + action
  4. On success: `complete(jobId)`
  5. On failure: `fail(jobId, errorMessage)` (auto dead-letters after 3 attempts)
- Must complete within Vercel serverless timeout (10s default, 60s max)
- Process jobs sequentially within a single invocation (parallel would risk rate limits)
- Log summary: `{ processed: N, succeeded: N, failed: N, deadLettered: N }`

### Claude's Discretion
- Exact CSS layout for health dashboard (follow existing card/table patterns)
- Error resolution hint mapping (common QBO errors → guidance text)
- Loading states and empty states on health dashboard
- Exact order of cascade syncs (item sync before invoice sync)
- Whether to show a sync progress indicator during manual sync triggers
- Toast notification wording for sync actions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `qbo-client.ts`: All Phase 2 methods available — `batchRequest()`, `queryEntities()`, `sendInvoiceEmail()`, `voidInvoice()`, `cdcRequest()`
- `qbo-sync.ts`: `getActiveConnection()`, `syncCustomerToQbo()`, `syncInvoiceToQbo()` (with account mapping gate), `requireAccountMapping()`
- `qbo-mapper.ts`: `toQboCustomer()`, `toQboInvoice()`, `toQboEstimate()`, `roundQboAmount()`
- `qbo-queue.ts`: `enqueue()`, `claimBatch()`, `complete()`, `fail()`, `resetStaleLocks()`, `getDeadLetters()`, `requeueDeadLetter()`
- `qbo-types.ts`: QboPayment, QboEstimate, QboItem, QboAccount interfaces already defined
- Shared UI: LoadingSpinner, Modal, ConfirmDialog, EmptyState, StatusBadge, PageHeader, Breadcrumbs
- `integrations.css`: Existing CSS for the QBO settings page — extend for health dashboard
- `vercel.json`: Existing cron config — add qbo-flush entry

### Established Patterns
- All QBO functions take `connection: QboConnection` as first param (no class pattern)
- API routes: `requireAuthSessionFirst()` → `{ orgId, userId, role }`, always include orgId
- Multi-tenant: every query includes orgId filter
- Error handling: try/catch → QboSyncLog entry → return `{ success, error }`
- CSS: Custom variables, no Tailwind, follow existing card/table/badge patterns
- Cron: Bearer token via CRON_SECRET, Vercel X-Vercel-Cron-Verified header

### Integration Points
- Webhook route: `src/app/api/integrations/qbo/webhook/route.ts` — rewrite to thin dispatcher
- Invoice detail page: needs "Send via QBO" button (find existing invoice detail page)
- QBO settings page: `src/app/(app)/settings/integrations/page.tsx` — add link to health dashboard
- Sidebar: add QBO Health link under Settings section in SidebarNav
- `vercel.json`: add `*/5 * * * *` cron for qbo-flush
- Prisma schema: may need `qboEntityId` + `qboRealmId` fields on QboSyncJob for webhook dedup

</code_context>

<specifics>
## Specific Ideas

- The webhook must return 200 within 50ms — this is critical because QBO retries aggressively on slow responses and can cause duplicate processing storms
- ItemRef on invoice lines is the #1 user-facing fix — without it, all revenue goes to "Uncategorized Income" in QBO P&L reports, which makes the integration look broken to accountants
- The health dashboard should give the business owner confidence that sync is working — think "at a glance, everything is green" with drill-down for problems
- Resolution hints on errors are key differentiation — most QBO integrations just show raw error messages

</specifics>

<deferred>
## Deferred Ideas

- Partial payment tracking with dedicated amount field on Invoice — Phase 4 (PAY-02) handles bidirectional invoice status sync
- Vendor sync — Phase 5 (VEND-01), no standalone Vendor model exists yet
- Class/Location tracking on synced transactions — Phase 5 (DIM-01, DIM-02)
- Token expiry monitoring cron — Phase 6 (DASH-04)
- Sync conflict resolution UI — v2 (ADV-03)

</deferred>

---

*Phase: 03-core-outbound*
*Context gathered: 2026-03-09*
