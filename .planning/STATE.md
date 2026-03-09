# Project State: QBO Full Integration

## Project Reference
See: .planning/PROJECT.md (updated 2026-03-07)
**Core value:** Every financial transaction flows to QBO automatically
**Current focus:** Phase 1 complete — ready for Phase 2

## Current Phase
Phase: 2
Status: Context gathered — ready for planning
Requirements: FOUND-10, ACCT-01, ACCT-02, ACCT-03

## Phase History
- Phase 1: Context completed 2026-03-08 (no gray areas — pure infrastructure)
- Phase 1: Plans created 2026-03-08 (7 plans, 3 waves)
- Phase 1: Executed 2026-03-08 (7 commits, all 9 FOUND requirements delivered)
- Phase 2: Context gathered 2026-03-09 (user deferred all decisions to Claude)

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

## Next Action
Plan Phase 2 → Execute Phase 2

---
*Last updated: 2026-03-09 after Phase 2 context gathered*
