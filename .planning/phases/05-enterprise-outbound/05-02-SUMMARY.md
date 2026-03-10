# Plan 05-02 Summary: Sync Functions + Flush Dispatcher Extension

**Status:** Complete
**Commit:** `143c676`
**Wave:** 2

## What Was Built

### Sync Functions (5 new)
- syncVendorToQbo — resolveOrCreateQboEntity collision handling, email matching
- syncEmployeeToQbo — TECH role guard, email collision handling
- syncTimeEntryToQbo — cascade employee + customer, STOPPED guard, PM→non-billable, ClassRef
- syncExpenseToQbo — Bill (vendor) vs Purchase (no vendor) branching, vendor cascade, account mapping gate
- syncCreditMemoToQbo — LinkedTxn to original invoice, customer cascade, ClassRef from WO

### Helper Functions (2 new)
- resolveOrCreateQboClass — auto-create QBO Classes from OrderType, cache in QboClassMap, returns null when disabled/error
- fetchAndCachePreferences — caches class/location tracking flags on QboConnection

### Flush Dispatcher
5 new cases: vendor:push, employee:push, timeActivity:push, expense:push, creditMemo:push

## Key Files
- src/lib/qbo/qbo-sync.ts — 7 new exported functions (~500 lines)
- src/app/api/cron/qbo-flush/route.ts — 5 new dispatch cases
