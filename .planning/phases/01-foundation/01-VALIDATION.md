---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing in project) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose src/lib/qbo/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose src/lib/qbo/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUND-04 | code assertion | `grep -r "minorversion" src/lib/qbo/` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | FOUND-03 | unit | `npx vitest run src/lib/qbo/__tests__/qbo-mapper.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | FOUND-01 | unit | `npx vitest run src/lib/qbo/__tests__/qbo-client.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | FOUND-02 | unit | `npx vitest run src/lib/qbo/__tests__/qbo-client.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | FOUND-05 | migration | `npx prisma migrate dev --name phase1-foundation` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 1 | FOUND-06 | migration | `npx prisma migrate dev --name phase1-foundation` | ✅ | ⬜ pending |
| 01-02-03 | 02 | 1 | FOUND-05/06 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 01-03-01 | 03 | 1 | FOUND-07 | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 1 | FOUND-08 | unit | `npx vitest run src/lib/qbo/__tests__/qbo-mapper.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 1 | FOUND-08 | build | `npx tsc --noEmit` (no I/O imports) | ✅ | ⬜ pending |
| 01-05-01 | 05 | 1 | FOUND-09 | unit | `npx vitest run src/lib/qbo/__tests__/qbo-queue.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/qbo/__tests__/qbo-client.test.ts` — stubs for FOUND-01 (mutex), FOUND-02 (merge update)
- [ ] `src/lib/qbo/__tests__/qbo-mapper.test.ts` — stubs for FOUND-03 (rounding), FOUND-08 (mappers)
- [ ] `src/lib/qbo/__tests__/qbo-queue.test.ts` — stubs for FOUND-09 (enqueue, claim, fail, stale)

*Vitest already installed — no framework setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prisma migration succeeds | FOUND-05, FOUND-06 | Requires database connection | Run `npx prisma migrate dev --name phase1-foundation`, verify exit code 0 |
| New tables exist with correct columns | FOUND-05 | Requires database | Check Prisma Studio or `\d "QboSyncJob"` in psql |
| No hardcoded minorversion strings | FOUND-04 | Code search | `grep -rn "minorversion" src/lib/qbo/` — only constant def + append |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
