---
phase: 3
slug: core-outbound
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose src/__tests__/lib/qbo/` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose src/__tests__/lib/qbo/`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ITEM-01 | unit | `npx vitest run src/__tests__/lib/qbo/qbo-mapper.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | VEND-02 | unit | `npx vitest run src/__tests__/lib/qbo/qbo-collision.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | ITEM-01 | unit | `npx vitest run src/__tests__/lib/qbo/qbo-sync-items.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | ITEM-02 | unit | `npx vitest run src/__tests__/lib/qbo/qbo-sync-invoice.test.ts` | ✅ | ⬜ pending |
| 03-02-03 | 02 | 1 | QUOT-01 | unit | `npx vitest run src/__tests__/lib/qbo/qbo-sync-quote.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | QUOT-02 | unit | `npx vitest run src/__tests__/lib/qbo/qbo-sync-invoice.test.ts` | ✅ | ⬜ pending |
| 03-02-05 | 02 | 1 | PAY-01 | unit | `npx vitest run src/__tests__/lib/qbo/qbo-payment.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SYNC-03 | unit | `npx vitest run src/__tests__/api/qbo-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | SYNC-04 | unit | `npx vitest run src/__tests__/api/qbo-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | PAY-03 | unit | `npx vitest run src/__tests__/api/qbo-email.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-04 | 03 | 2 | DASH-05 | unit | `npx vitest run src/__tests__/api/qbo-cron.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | DASH-01 | unit | `npx vitest run src/__tests__/api/qbo-health.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 2 | DASH-02 | unit | `npx vitest run src/__tests__/api/qbo-health.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-03 | 04 | 2 | DASH-03 | unit | `npx vitest run src/__tests__/api/qbo-health.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/lib/qbo/qbo-mapper.test.ts` — add toQboItem tests (ITEM-01)
- [ ] `src/__tests__/lib/qbo/qbo-collision.test.ts` — resolveOrCreateQboEntity tests (VEND-02)
- [ ] `src/__tests__/lib/qbo/qbo-sync-items.test.ts` — material/labor rate sync tests (ITEM-01)
- [ ] `src/__tests__/lib/qbo/qbo-sync-quote.test.ts` — quote sync tests (QUOT-01, QUOT-02)
- [ ] `src/__tests__/lib/qbo/qbo-payment.test.ts` — payment processing tests (PAY-01)
- [ ] `src/__tests__/api/qbo-webhook.test.ts` — webhook dispatcher + dedup tests (SYNC-03, SYNC-04)
- [ ] `src/__tests__/api/qbo-email.test.ts` — send invoice email API test (PAY-03)
- [ ] `src/__tests__/api/qbo-cron.test.ts` — queue flush cron tests (DASH-05)
- [ ] `src/__tests__/api/qbo-health.test.ts` — health endpoint tests (DASH-01, DASH-02, DASH-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QBO sandbox payment → invoice PAID | PAY-01 | Requires live QBO sandbox | Create payment in QBO sandbox, fire webhook, run cron, check invoice status |
| QBO sent email status | PAY-03 | Requires live QBO sandbox | Trigger send via API, verify EmailStatus in QBO |
| Health dashboard layout/UX | DASH-01 | Visual verification | Navigate /settings/integrations/qbo-health, verify cards, stat bars, table |
| Webhook response time <200ms | SYNC-03 | Network timing | Time POST to webhook endpoint with multi-entity payload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
