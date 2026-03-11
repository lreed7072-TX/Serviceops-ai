# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — QBO Full Integration

**Shipped:** 2026-03-10
**Phases:** 6 | **Plans:** 29 | **Sessions:** ~4

### What Was Built
- Complete bidirectional QBO integration: 12 entity types, 18 sync functions, 4 cron jobs
- Durable queue system with priority levels, stale lock detection, dead letter handling
- CDC polling engine for inbound sync with per-org cursor management
- Integration health dashboard with error logs, resolution hints, manual triggers
- QBO Financial Reports tab (P&L, A/R Aging, Balance Sheet) embedded in analytics
- Proactive token expiry monitoring with admin alerts
- 163 QBO-specific unit tests across 18 test files

### What Worked
- **Wave-based parallelization**: Independent plans executed in parallel waves, reducing wall-clock time
- **Pure mapper pattern**: All QBO transformations as pure functions with no I/O made testing trivial
- **Prerequisite gating**: Account mapping gate prevented broken syncs from ever reaching production
- **Thin webhook dispatcher**: Returning 200 immediately and deferring to queue eliminated timeout issues
- **Phase-by-phase execution**: Clear dependency chains (Foundation → Client → Outbound → Inbound → Enterprise) prevented rework
- **Schema-first approach**: Prisma models defined upfront in Phase 1, all subsequent phases built on stable schema

### What Was Inefficient
- **Phase 1 had no SUMMARY.md files**: GSD tooling sees it as incomplete even though all 7 plans were executed
- **Phase 6 summaries not written**: Same issue — execution happened but GSD disk artifacts were incomplete
- **STATE.md grew too large**: Accumulated every phase's execution log (300+ lines), should have been trimmed per-milestone
- **REQUIREMENTS.md traceability table never updated**: All 42 stayed "Pending" despite being delivered — should auto-update on phase completion

### Patterns Established
- **Resolver pattern**: `resolveOrCreateQbo[Entity]` — query-before-create with collision handling, used for Customer, Class, Location
- **Cascade sync**: Parent entities auto-sync children (e.g., invoice sync cascades to customer → materials → labor rates)
- **Preferences guard**: Check QBO company preferences before sending dimensional refs (Class/Location), null when disabled
- **Priority queue**: Priority 1 = manual trigger, 5 = normal, 9 = background — ensures admin actions process first
- **Fetch-Merge-POST**: Always fetch current entity before update to prevent sparse update corruption

### Key Lessons
1. **Define all QBO types upfront** — having `qbo-types.ts` with 35+ interfaces from Phase 1 made every subsequent phase faster
2. **Test pure functions, mock I/O** — pure mappers are trivially testable; sync functions need mocked Prisma + QBO client
3. **Webhook idempotency is non-negotiable** — QBO can deliver the same event multiple times; dedup guard on (entityType, entityId, status) is essential
4. **SyncToken is optimistic concurrency** — every QBO update must fetch current entity first; can't cache SyncTokens
5. **Batch operations are limited** — QBO batch endpoint has quirks (30 max, no mixed entity types), but worth it for bulk initial sync

### Cost Observations
- Model mix: ~70% sonnet (plan execution), ~20% opus (architecture/decisions), ~10% haiku (quick searches)
- Sessions: ~4 sessions across 3 days
- Notable: Entire 42-requirement milestone completed in 3 calendar days with AI-assisted development

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~4 | 6 | First GSD milestone — established wave-based execution pattern |

### Cumulative Quality

| Milestone | Tests | Coverage | Files Changed |
|-----------|-------|----------|---------------|
| v1.0 | 250 | N/A | 114 |

### Top Lessons (Verified Across Milestones)

1. Schema-first development with upfront type definitions accelerates all subsequent work
2. Pure function pattern (mappers, validators) makes testing trivial and eliminates integration surprises
3. Wave-based plan execution with clear dependency chains prevents rework
