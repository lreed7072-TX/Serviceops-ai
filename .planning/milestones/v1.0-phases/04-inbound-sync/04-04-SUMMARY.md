---
plan: "04-04"
title: "Unit tests for inbound sync functions, CDC cron, and void flow"
status: complete
executed_at: "2026-03-09T14:36:00.000Z"
commits:
  - "2e18d4d — test(qbo): inbound customer sync tests (5 tests)"
  - "c605a27 — test(qbo): CDC invoice change detection tests (6 tests)"
  - "526f5e9 — test(qbo): void invoice outbound tests (4 tests)"
  - "cda8410 — test(qbo): CDC cron route tests (4 tests)"
  - "03d9c0b — test(qbo): flush dispatcher inbound handler tests (3 tests)"
---

# Summary: Plan 04-04 — Inbound Sync Unit Tests

## What Was Done

Created 5 test files covering all Phase 4 functionality: inbound customer sync,
CDC invoice change detection, outbound void, the CDC cron route, and flush dispatcher
inbound job routing. Each file was committed individually per the atomic commit strategy.

## Files Created

| File | Tests | Status |
|------|-------|--------|
| `src/__tests__/lib/qbo/inbound-customer.test.ts` | 5 | Pass |
| `src/__tests__/lib/qbo/cdc-invoice.test.ts` | 6 | Pass |
| `src/__tests__/lib/qbo/void-invoice.test.ts` | 4 | Pass |
| `src/__tests__/lib/qbo/cdc-cron.test.ts` | 4 | Pass |
| `src/__tests__/lib/qbo/flush-inbound.test.ts` | 3 | Pass |

**Total: 22 tests, all passing**

## Test Coverage Summary

### inbound-customer.test.ts (5 tests)
- `processInboundCustomer`: update by QBO ID (with `fieldsUpdated` log metadata)
- `processInboundCustomer`: email fallback when no QBO ID match
- `processInboundCustomer`: create new customer (with `action: "created_inbound"` log)
- `processInboundCustomer`: `Active: false` guard — `status` never written to ServiceOps
- `processCdcCustomerPull`: fetches QBO customer then delegates to processInboundCustomer

### cdc-invoice.test.ts (6 tests)
- `processCdcInvoiceChange`: marks CANCELED on `status: "Voided"`
- `processCdcInvoiceChange`: no-op when already CANCELED
- `processCdcInvoiceChange`: marks PAID with `paidAt` when `Balance: 0` and not voided
- `processCdcInvoiceChange`: no-op when already PAID
- `processCdcInvoiceChange`: logs partial payment (`remainingBalance`, note) with no status change
- `processCdcInvoiceChange`: returns success when invoice not in ServiceOps

### void-invoice.test.ts (4 tests)
- `processVoidInvoiceInQbo`: successful void with fresh SyncToken, success log
- `processVoidInvoiceInQbo`: already-voided guard — `voidInvoice` not called, idempotent log
- `processVoidInvoiceInQbo`: returns error when `qboInvoiceId` is null
- `processVoidInvoiceInQbo`: returns error when no active connection

### cdc-cron.test.ts (4 tests)
- First-run cursor creation: `cdcRequest` called with Date ~4 hours ago, cursor advanced
- Jobs enqueued: 2 customer:pull + 1 invoice:pull from CDC response, cursor advanced
- Cursor NOT advanced on failure: `upsert` with `lastPollStatus: "failed"`, `lastPollAt` absent from update
- Multi-org isolation: 3 orgs, second fails, first and third succeed independently

### flush-inbound.test.ts (3 tests)
- `invoice:pull` dispatched to `processCdcInvoiceChange(orgId, qboEntityId, realmId)`
- `customer:pull` dispatched to `processCdcCustomerPull(orgId, qboEntityId, realmId)`
- `invoice:void` dispatched to `processVoidInvoiceInQbo(orgId, entityId)`

## Mock Strategy

All test files follow the established patterns from Phase 3:
- `vi.mock("@/lib/prisma")` with typed mock objects
- `vi.mock("@/lib/qbo/qbo-client")` for QBO API calls
- `vi.mock("@/lib/qbo/qbo-mapper")` to keep pure functions from pulling in Prisma types
- `vi.mock("@/lib/qbo/qbo-sync")` in flush-inbound to isolate dispatcher routing
- `process.env.CRON_SECRET = "test-secret"` + `NextRequest` helpers for route tests
- `vi.clearAllMocks()` in `beforeEach` for isolation

## Verification Results

```
npx vitest run src/__tests__/lib/qbo/
  10 passed | 2 skipped (pre-existing stubs)
  77 tests passing | 32 todo (pre-existing stubs)
  0 failures

npx vitest run (full suite)
  6 pre-existing failures (multi-tenant, quotes, work-orders, invoices)
  — identical before and after this plan (zero regressions introduced)
```

## Requirements Verified

- PAY-02: `processCdcInvoiceChange` (void + payment), `processVoidInvoiceInQbo` (outbound cancel)
- SYNC-01: CDC cron cursor creation, advance, failure isolation
- SYNC-02: `processInboundCustomer` field-ownership split (QBO wins on billing, not status)
