---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
last_updated: "2026-03-09T19:40:47.307Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 13
  completed_plans: 12
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
last_updated: "2026-03-09T18:30:00.000Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
---

# Project State: QBO Full Integration

## Project Reference
See: .planning/PROJECT.md (updated 2026-03-07)
**Core value:** Every financial transaction flows to QBO automatically
**Current focus:** Phase 3 COMPLETE — all 5 plans executed, all 13 requirements delivered

## Current Phase
Phase: 3
Status: Complete — all 5 plans executed
Requirements: PAY-01, PAY-03, QUOT-01, QUOT-02, ITEM-01, ITEM-02, VEND-02, SYNC-03, SYNC-04, DASH-01, DASH-02, DASH-03, DASH-05

## Phase History
- Phase 1: Context completed 2026-03-08 (no gray areas — pure infrastructure)
- Phase 1: Plans created 2026-03-08 (7 plans, 3 waves)
- Phase 1: Executed 2026-03-08 (7 commits, all 9 FOUND requirements delivered)
- Phase 2: Context gathered 2026-03-09 (user deferred all decisions to Claude)
- Phase 2: Plans created 2026-03-09 (4 plans, 2 waves)
- Phase 2: Executed 2026-03-09 (16 commits, all 4 requirements delivered — FOUND-10, ACCT-01, ACCT-02, ACCT-03)
- Phase 2: Verified 2026-03-09 (15/15 UAT tests passed, 0 issues)

## Decisions Log
- Token refresh mutex: CAS flag on QboConnection (PgBouncer blocks SELECT FOR UPDATE)
- Sparse update fix: Fetch-Merge-POST pattern for all QBO entity updates
- Decimal rounding: roundQboAmount() helper, .toFixed(2) before API
- API version: Pin minorversion=75 as QBO_API_VERSION constant
- Queue design: Prisma-based QboSyncJob, priority 1/5/9, 120s stale lock, 3 retries → dead_letter
- Types scope: All QBO entity interfaces defined upfront (27 type exports)
- Mapper pattern: Pure functions, no I/O, merge-based for updates
- Vendor model: Deferred to Phase 5 (no standalone Vendor model exists yet)
- Test stubs at src/__tests__/lib/qbo/ (matches vitest config include pattern)

## Phase 2 Decisions
- No DB caching for Chart of Accounts — re-fetch live from QBO on page load
- Account mapping saved in QboAccountMap via upsert on @@unique([orgId, category])
- 5 categories: labor_income, materials_income, service_income, job_cost_expense, subcontractor_expense
- Per-row optimistic save on dropdown change (no global Save button)
- Gate check in syncInvoiceToQbo() only — syncCustomerToQbo() is not gated (not a financial txn)
- sendInvoiceEmail() requires extending qboRequest() with optional contentType param
- voidInvoice() uses ?operation=void query param (not sparse update with void: true)

## Phase 2 Execution Log
- Phase 2, Plan 01: Complete (2026-03-09) — QBO client extension methods + batch types
  - 4 commits: 85458b9, 64a6acd, 34bd36b, 5e2ac5b
  - Added QboBatchOperation, QboBatchItemResponse types
  - Extended qboRequest() with optional contentType
  - Added batchRequest, queryEntities, cdcRequest, voidInvoice, sendInvoiceEmail

- Phase 2, Plan 02: Complete (2026-03-09) — Account mapping API routes + prerequisite gate helpers
  - 4 commits: a779b57, 60f9588, b354528, 506f3d2
  - Created GET /api/integrations/qbo/accounts (live QBO fetch via queryEntities)
  - Created GET/PUT /api/integrations/qbo/account-mapping (CRUD, ADMIN-only PUT, 5 categories)
  - Added getAccountMapping() + requireAccountMapping() to qbo-sync.ts
  - syncInvoiceToQbo() now gated — blocks with descriptive error when mapping incomplete

- Phase 2, Plan 03: Complete (2026-03-09) — Unit tests for client extensions + account mapping gate
  - 2 commits: 616e9fa, 6369bcb
  - 17 new tests (10 client extension + 7 account mapping gate)
  - All 17 passing, 0 failures

- Phase 2, Plan 04: Complete (2026-03-09) — Account mapping UI + warning banner
  - 2 commits: 59778de, 8aafc13
  - Chart of Accounts Mapping section on integrations page
  - 5 category dropdowns with filtered account types (Income vs Expense)
  - Optimistic save per row with revert-on-failure
  - Yellow warning banner when mapping incomplete

## Phase 3 Decisions
- Payment: Mark PAID only when QBO invoice Balance=0 (no partial payment field on Invoice model)
- Items: All materials sync as NonInventory type (no QBO inventory tracking)
- DisplayName collision: Query-before-create, match on email (customers) or name+type (items), append "(SvcOps)" suffix on collision
- Webhook rewrite: Thin dispatcher → enqueue to QboSyncJob → return 200 in <50ms
- Dedup: Check existing pending/claimed job with same (entityType, qboEntityId, action) before enqueue
- Queue flush: 30 jobs per invocation, sequential processing, every 5 minutes
- Health dashboard: New page /settings/integrations/qbo-health
- Estimate-to-invoice: LinkedTxn reference when quote has qboEstimateId
- ItemRef cascade: Auto-sync materials/labor rates before invoice sync if missing qboItemId

## Phase 3 Planning
- Phase 3: Plans created 2026-03-09 (5 plans, 4 waves, 13 requirements)
  - Plan 01 (Wave 1): Schema migration + QBO client extensions + mapper + collision helper
  - Plan 02 (Wave 2): Sync functions — item, customer retrofit, quote, invoice (ItemRef+LinkedTxn), payment
  - Plan 03 (Wave 3): API routes — webhook rewrite, email, health/logs/trigger, cron flush
  - Plan 04 (Wave 4): UI — Send via QBO button, health dashboard, sidebar/settings links
  - Plan 05 (Wave 4): Unit tests for sync, webhook, cron, mapper
- Phase 3: Verification PASSED (8/8 dimensions, 13/13 requirements covered)

## Phase 3 Execution Log
- Phase 3, Plan 01: Complete (2026-03-09) — Schema migration + QBO client extensions + mapper + collision helper
  - 5 commits: 540ed00, 248d355, 31bd2a6, d247246, c9ba034
  - Added qboEntityId/qboRealmId dedup fields + index to QboSyncJob
  - Added 7 new QBO client functions: getPayment, createItem, getItem, updateItem, createEstimate, getEstimate, updateEstimate
  - Added toQboItem pure mapper (NonInventory + Service types)
  - Added resolveOrCreateQboEntity collision helper (VEND-02)
  - Build passes, 0 errors

- Phase 3, Plan 02: Complete (2026-03-09) — Sync functions: item, customer retrofit, quote, invoice (ItemRef+LinkedTxn), payment
  - 6 commits: f91dbc3, fea9c05, 8df42fa, 6437788, e77dea7, 5b3c33d
  - syncMaterialToQbo: Material → QBO NonInventory Item with collision handling
  - syncLaborRateToQbo: LaborRate → QBO Service Item with collision handling
  - syncCustomerToQbo: Retrofitted create path with resolveOrCreateQboEntity (email matching)
  - syncQuoteToQbo: Quote → QBO Estimate with status guard, cascade customer/material sync, ItemRef on lines
  - syncInvoiceToQbo: Rewritten with materialUsage→material ItemRef chain, LinkedTxn from estimate, cascade syncs
  - processPaymentJob: QBO Payment → marks invoice PAID when Balance=0, logs partial payments
  - createInvoice (qbo-client.ts): Extended with itemRef per line + linkedTxn param
  - Build passes, 0 errors
  - Requirements delivered: ITEM-01, ITEM-02, VEND-02, QUOT-01, QUOT-02, PAY-01

- Phase 3, Plan 03: Complete (2026-03-09) — API routes: webhook rewrite, email, health/logs/trigger, cron flush
  - 7 commits: 69e6dec, f2e53b1, 3e4aa6e, 3609f0b, c423aae, 79cb405, 51aff3c
  - Webhook POST rewritten as thin dispatcher — enqueue only, no QBO API calls, returns 200 in <50ms
  - send-invoice-email: POST endpoint sends invoice via QBO email API, logs to QboSyncLog
  - health: GET endpoint with connection status, per-entity sync stats, queue stats
  - sync-logs: GET endpoint with paginated error logs + 9 resolution hint patterns
  - sync-trigger: POST endpoint (ADMIN only) enqueues manual sync jobs by entity type (priority 1)
  - qbo-flush cron: GET endpoint processes 30 jobs/invocation, dispatches by entityType:action
  - vercel.json: 2 cron entries (generate-pms daily + qbo-flush every 5 min)
  - Build passes, 0 errors
  - Requirements delivered: SYNC-03, SYNC-04, PAY-03, DASH-01, DASH-02, DASH-03, DASH-05

- Phase 3, Plan 04: Complete (2026-03-09) — UI: Send via QBO button, health dashboard, sidebar/settings links
  - 5 commits: 975afeb, c121f56, 92da187, 4612d26, 2fff22f
  - Invoice detail: "Send via QBO" button (conditional on qboInvoiceId), calls send-invoice-email endpoint
  - QBO Health dashboard: /settings/integrations/qbo-health with connection status, queue stats, entity sync grid, error log table
  - QBO Health CSS: 514 lines, CSS variables, responsive at 768px/480px
  - Integrations page: "View Sync Health" link (orange outline) when connected
  - Sidebar: "QBO Health" link in Admin section with Activity icon
  - Build passes, 0 errors
  - Requirements delivered (UI layer): PAY-03, DASH-01, DASH-02, DASH-03

- Phase 3, Plan 05: Complete (2026-03-09) — Unit tests for sync, webhook, cron, mapper
  - 3 commits: 5451dda, c86d848, 2d1a86d
  - mapper-items.test.ts: 11 tests (toQboItem pure mapper + resolveOrCreateQboEntity collision helper)
  - sync-functions.test.ts: 14 tests (syncMaterialToQbo, syncQuoteToQbo, syncInvoiceToQbo, processPaymentJob)
  - webhook-cron.test.ts: 13 tests (webhook dedup + cron dispatcher routing)
  - 38 new tests, all passing, 0 regressions in existing suite
  - Requirements verified: PAY-01, ITEM-01, ITEM-02, VEND-02, QUOT-01, QUOT-02, SYNC-03, SYNC-04, DASH-05

## Phase 4 Decisions
- `voidInvoice` and `getCustomer` imports added to qbo-sync.ts in task 03 commit (both needed for tasks 03 and 05)
- InvoiceStatus string literals used directly ("CANCELED"/"PAID") — no extra import needed, matches Prisma enum values exactly
- processCdcInvoiceChange handles QBO-only invoices (not in ServiceOps) gracefully: log + return success
- processVoidInvoiceInQbo logs success (not error) on already-voided guard — idempotent semantics

## Phase 4 Execution Log
- Phase 4, Plan 01: Complete (2026-03-09) — QboInvoice type fix + 4 inbound sync functions
  - 5 commits: 4a8c8ef, 1aa290c, 80c752b, 4d492df, 21d6c7b
  - Added `status?: string` to QboInvoice for void detection
  - processInboundCustomer: create/update with field-ownership split (SYNC-02)
  - processCdcCustomerPull: cron dispatcher wrapper
  - processCdcInvoiceChange: void + full/partial payment detection (PAY-02 inbound)
  - processVoidInvoiceInQbo: outbound cancel via void API (PAY-02 outbound)
  - Build passes, 0 QBO file errors

- Phase 4, Plan 02: Complete (2026-03-09) — CDC cron route + flush dispatcher extension + vercel.json
  - 3 commits: 9b8194a, 38d7585, 04413db
  - Created GET /api/cron/qbo-cdc (212 lines): polls QBO CDC every 4h for Customer+Invoice changes
  - First-run default lastPollAt = now - 4h; cursor advances only on success
  - Multi-org isolation: per-org try/catch, failure cursor upsert, processing continues
  - Dedup guard on (qboEntityId, entityType, status IN [pending,claimed]) before enqueue
  - Writes qboEntityId + qboRealmId onto each created job row
  - Extended qbo-flush dispatchJob switch: invoice:pull, customer:pull, invoice:void
  - vercel.json now has 3 cron entries (generate-pms daily, qbo-flush 5min, qbo-cdc 4h)
  - Build passes, 0 application file errors
  - Requirements delivered (dispatch layer): SYNC-01, SYNC-02, PAY-02

- Phase 4, Plan 03: Complete (2026-03-09) — Void trigger wired into invoice PATCH endpoint
  - 1 commit: dd9d078
  - Added `enqueue` import to invoice PATCH route
  - CANCELED transition guard: enqueues invoice:void (priority 1) fire-and-forget when qboInvoiceId exists
  - Pre-update existing.qboInvoiceId check guards against enqueuing for non-QBO-synced invoices
  - Build passes, 0 errors in application files
  - Requirement delivered: PAY-02 (outbound cancel → QBO void trigger)

- Phase 4, Plan 04: Complete (2026-03-09) — Unit tests for inbound sync, CDC cron, and void flow
  - 5 commits: 2e18d4d, c605a27, 526f5e9, cda8410, 03d9c0b
  - inbound-customer.test.ts: 5 tests (processInboundCustomer + processCdcCustomerPull)
  - cdc-invoice.test.ts: 6 tests (processCdcInvoiceChange: void, PAID, partial, no-op, orphan)
  - void-invoice.test.ts: 4 tests (processVoidInvoiceInQbo: success, guard, no-qboId, no-conn)
  - cdc-cron.test.ts: 4 tests (first-run, enqueue, failure no-advance, multi-org isolation)
  - flush-inbound.test.ts: 3 tests (invoice:pull, customer:pull, invoice:void dispatch routing)
  - 22 new tests all passing, 0 regressions in existing suite
  - Requirements verified: PAY-02, SYNC-01, SYNC-02

## Phase 4 Complete
All 4 plans executed. Phase 4 deliverables:
- Plan 01: processInboundCustomer, processCdcCustomerPull, processCdcInvoiceChange, processVoidInvoiceInQbo
- Plan 02: GET /api/cron/qbo-cdc + flush dispatcher extended (invoice:pull, customer:pull, invoice:void) + vercel.json
- Plan 03: PATCH /api/invoices/[id] wired — CANCELED transition enqueues invoice:void
- Plan 04: 22 unit tests covering all Phase 4 functions and routes

## Next Action
Phase 4 complete. All requirements PAY-02, SYNC-01, SYNC-02 delivered and tested.

---
*Last updated: 2026-03-09 after Phase 4 Plan 04 executed*
