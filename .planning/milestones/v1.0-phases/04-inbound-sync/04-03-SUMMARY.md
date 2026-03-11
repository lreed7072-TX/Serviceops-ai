---
phase: 04-inbound-sync
plan: "04-03"
subsystem: payments
tags: [qbo, invoice, void, queue, fire-and-forget]

# Dependency graph
requires:
  - phase: 04-01
    provides: processVoidInvoiceInQbo() function that the enqueued job will call
  - phase: 03-outbound-sync
    provides: enqueue() in qbo-queue, getActiveConnection() in qbo-sync

provides:
  - Void trigger wired into invoice PATCH endpoint — CANCELED status change enqueues invoice:void job

affects: [04-04, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fire-and-forget queue enqueue on status transition in PATCH route
    - Transition guard (existing.status !== "CANCELED") prevents duplicate enqueue
    - Pre-update value check (existing.qboInvoiceId) for sync eligibility

key-files:
  created: []
  modified:
    - src/app/api/invoices/[id]/route.ts

key-decisions:
  - "Used string literal 'CANCELED' (not InvoiceStatus.CANCELED) for the void trigger — consistent with how the codebase handles the PAID guard above it, and avoids importing an enum value that's already indirectly available"
  - "Checks existing.qboInvoiceId (pre-update value) — qboInvoiceId does not change during a status update, so this is always safe"

patterns-established:
  - "Status-transition trigger pattern: if (body?.status === X && existing.status !== X) { if (existing.qboField) { getActiveConnection().then(conn => { if (conn) { enqueue(...).catch(...) } }) } }"

requirements-completed:
  - PAY-02

# Metrics
duration: 5min
completed: 2026-03-09
---

# Plan 04-03: Invoice Cancellation Void Trigger Summary

**Fire-and-forget invoice:void enqueue wired into PATCH endpoint — CANCELED status transition triggers QBO void via priority-1 queue job**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-09T00:00:00Z
- **Completed:** 2026-03-09T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `enqueue` import from `@/lib/qbo/qbo-queue` to the invoice PATCH route
- Wired CANCELED transition guard after the existing SENT trigger block
- Checks `existing.qboInvoiceId` to skip enqueue for invoices not synced to QBO
- Priority 1 (user-triggered) — near-real-time processing by cron flush

## Task Commits

Each task was committed atomically:

1. **Task 04-03-01: Add void trigger to invoice PATCH endpoint** - `dd9d078` (feat)

## Files Created/Modified
- `src/app/api/invoices/[id]/route.ts` - Added `enqueue` import + CANCELED void trigger block after SENT trigger block

## Decisions Made
- Used string literal `"CANCELED"` (single L) rather than `InvoiceStatus.CANCELED` enum — consistent with the surrounding code style and avoids an unnecessary import; the string literal matches the Prisma enum value exactly
- Checked `existing.qboInvoiceId` (pre-update) because `qboInvoiceId` is never mutated by a status PATCH, making the pre-fetch value always correct for this guard

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript check shows 0 errors in application files. Pre-existing test-file errors in `__tests__/` are unrelated to this change and were present before.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PAY-02 outbound direction (ServiceOps cancel → QBO void) is now fully wired: PATCH route enqueues the job, cron flush calls `processVoidInvoiceInQbo()` which calls `voidInvoice()` on the QBO client
- Ready to proceed to Plan 04-04

---
*Phase: 04-inbound-sync*
*Completed: 2026-03-09*
