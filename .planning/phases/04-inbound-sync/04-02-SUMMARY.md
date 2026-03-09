---
plan: "04-02"
title: "CDC cron route + flush dispatcher extension + vercel.json"
status: complete
date: "2026-03-09"
commits: 3
requirements: [SYNC-01, PAY-02, SYNC-02]
---

# Plan 04-02 Execution Summary

## What Was Done

3 tasks executed atomically (one commit each) delivering the CDC polling
engine, the three new inbound dispatcher cases, and the vercel.json
cron registration.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 9b8194a | 04-02-01 | Create `/api/cron/qbo-cdc` CDC polling engine |
| 38d7585 | 04-02-02 | Extend qbo-flush dispatcher with invoice:pull, customer:pull, invoice:void |
| 04413db | 04-02-03 | Register qbo-cdc cron in vercel.json at `0 */4 * * *` |

## Files Created/Modified

- `src/app/api/cron/qbo-cdc/route.ts` — **new file**, 212 lines; CDC polling engine
- `src/app/api/cron/qbo-flush/route.ts` — +31 lines; 3 new case blocks + 3 new imports
- `vercel.json` — +4 lines; third cron entry added

## Architecture Delivered

### GET /api/cron/qbo-cdc (SYNC-01)
Runs every 4 hours via Vercel Cron. Per-org flow:

1. Fetch or create `QboCdcCursor` (first-run default: `lastPollAt = now - 4h`)
2. Call `cdcRequest(connection, ["Customer", "Invoice"], cursor.lastPollAt)`
3. Parse entities with `parseCdcEntities()` helper (CDCResponse → named array)
4. Dedup check on `(qboEntityId, entityType, status IN [pending,claimed])`
5. Enqueue `customer:pull` / `invoice:pull` jobs at priority 5
6. Write `qboEntityId` + `qboRealmId` onto the created job row
7. Advance cursor `lastPollAt = now` on success; **do NOT advance on failure**
8. CDC truncation warning at 1000-entity limit

Multi-org isolation: one org's exception is caught at the outer loop,
failure cursor is upserted, and processing continues for remaining orgs.

### qbo-flush dispatcher additions (SYNC-01, SYNC-02, PAY-02)
Three new cases in `dispatchJob()` switch:

| Case | Handler | ID source |
|------|---------|-----------|
| `invoice:pull` | `processCdcInvoiceChange()` | `payload.qboEntityId` or `job.qboEntityId` |
| `customer:pull` | `processCdcCustomerPull()` | `payload.qboEntityId` or `job.qboEntityId` |
| `invoice:void` | `processVoidInvoiceInQbo()` | `job.entityId` (ServiceOps invoice ID) |

### vercel.json — 3 cron entries
```
0 6 * * *        /api/cron/generate-pms   (daily PM generation)
*/5 * * * *      /api/cron/qbo-flush      (queue flush, every 5 min)
0 */4 * * *      /api/cron/qbo-cdc        (CDC inbound poll, every 4h)
```

## Decisions Made

- `invoice:pull` and `customer:pull` extract `qboEntityId` from payload first,
  falling back to `job.qboEntityId` — covers both the CDC-enqueued path
  (payload set by cron) and any manually-enqueued pull jobs
- `invoice:void` uses `job.entityId` (ServiceOps invoice ID), not a QBO ID —
  `processVoidInvoiceInQbo()` fetches the fresh SyncToken internally
- Variable names in new dispatcher cases use unique prefixes (`invPullResult`,
  `custPullResult`, `voidResult`) to avoid collision with the existing
  `payResult` block
- First-run CDC default of 4 hours matches the cron interval — prevents
  accumulating a large historical backlog on first deployment

## Verification

- `npx tsc --noEmit` — 0 errors in application files (pre-existing test
  file errors in `__tests__/` are unrelated)
- `python3` JSON parse confirms exactly 3 crons in vercel.json

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All TypeScript types resolved without modification. `QboCdcResponse`,
`QboConnection`, `enqueue()`, and all three sync functions were already
available from prior plan commits.

## Next Phase Readiness

- SYNC-01 (CDC inbound poll) is now fully wired end-to-end
- SYNC-02 (customer inbound field-ownership split) is dispatched via customer:pull
- PAY-02 inbound (QBO invoice → ServiceOps status update) dispatched via invoice:pull
- PAY-02 outbound (ServiceOps CANCELED → QBO void) dispatched via invoice:void
- Ready to proceed to Plan 04-04 (tests)

---
*Phase: 04-inbound-sync*
*Completed: 2026-03-09*
