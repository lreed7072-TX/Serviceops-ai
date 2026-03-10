---
phase: 5
slug: enterprise-outbound
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/lib/qbo/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/lib/qbo/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | VEND-01 | unit | `npx vitest run src/__tests__/lib/qbo/vendor-sync.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | TIME-01 | unit | `npx vitest run src/__tests__/lib/qbo/employee-sync.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | TIME-02 | unit | `npx vitest run src/__tests__/lib/qbo/time-activity-sync.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | EXP-01 | unit | `npx vitest run src/__tests__/lib/qbo/expense-sync.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 2 | QUOT-03 | unit | `npx vitest run src/__tests__/lib/qbo/credit-memo-sync.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | DIM-01 | unit | `npx vitest run src/__tests__/lib/qbo/class-tracking.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 3 | DIM-03 | unit | `npx vitest run src/__tests__/lib/qbo/preferences-check.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 4 | ALL | unit | `npx vitest run src/__tests__/lib/qbo/ --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing test infrastructure covers Phase 5 — vitest already configured, 12 test files, 77 tests passing
- [ ] Test stubs will be created in the final wave (Plan 04) per established Phase 3-4 pattern

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QBO Health dashboard yellow banner when Class tracking disabled | DIM-03 | UI rendering | Load /settings/integrations/qbo-health with classTrackingEnabled=false on QboConnection, verify yellow banner appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
