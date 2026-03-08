# Project State: QBO Full Integration

## Project Reference
See: .planning/PROJECT.md (updated 2026-03-07)
**Core value:** Every financial transaction flows to QBO automatically
**Current focus:** Phase 1 — Foundation & Bug Fixes

## Current Phase
Phase: 1
Status: Plans Ready
Plans: 5/5

## Phase History
- Phase 1: Context completed 2026-03-08 (no gray areas — pure infrastructure)
- Phase 1: Plans created 2026-03-08 (5 plans, 2 waves, 17 tasks)

## Decisions Log
- Token refresh mutex: CAS flag on QboConnection (PgBouncer blocks SELECT FOR UPDATE)
- Sparse update fix: Fetch-Merge-POST pattern for all QBO entity updates
- Decimal rounding: roundQboAmount() helper, .toFixed(2) before API
- API version: Pin minorversion=75 as QBO_API_VERSION constant
- Queue design: Prisma-based QboSyncJob, priority 1/5/9, 120s stale lock, 3 retries → dead_letter
- Types scope: All QBO entity interfaces defined upfront (18 entities + common types)
- Mapper pattern: Pure functions, no I/O, merge-based for updates
- Vendor model: Deferred to Phase 5 (no standalone Vendor model exists yet)

---
*Last updated: 2026-03-08 after Phase 1 plans created*
