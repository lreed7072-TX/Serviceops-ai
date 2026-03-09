# Project State: QBO Full Integration

## Project Reference
See: .planning/PROJECT.md (updated 2026-03-07)
**Core value:** Every financial transaction flows to QBO automatically
**Current focus:** Phase 2 complete — ready for Phase 3

## Current Phase
Phase: 3
Status: Not started — ready for context gathering
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

## Next Action
Start Phase 3: /gsd:discuss-phase 3

---
*Last updated: 2026-03-09 after Phase 2 verification passed*
