---
phase: 4
slug: inbound-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/lib/qbo/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/lib/qbo/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PAY-02 | unit | `npx vitest run src/__tests__/lib/qbo/cdc-invoice.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | PAY-02 | unit | `npx vitest run src/__tests__/lib/qbo/void-invoice.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | SYNC-02 | unit | `npx vitest run src/__tests__/lib/qbo/inbound-customer.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | SYNC-01 | unit | `npx vitest run src/__tests__/lib/qbo/cdc-cron.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | PAY-02, SYNC-02 | unit | `npx vitest run src/__tests__/lib/qbo/flush-inbound.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Vitest is installed, test stubs at `src/__tests__/lib/qbo/` exist from Phases 1-3. New test files will be created in the test plan.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QBO sandbox void round-trip | PAY-02 | Requires live QBO sandbox OAuth | Create invoice in QBO, void it, trigger CDC cron, verify ServiceOps status = CANCELED |
| CDC cursor advance in production | SYNC-01 | Requires Vercel Cron trigger | Call `/api/cron/qbo-cdc` with CRON_SECRET, check DB cursor row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
