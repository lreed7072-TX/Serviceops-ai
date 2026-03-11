---
phase: 6
slug: enterprise-showcase
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | PO-01 | unit | `npx vitest run mapper-phase6` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | DIM-02 | unit | `npx vitest run location-tracking` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | PO-01 | unit | `npx vitest run sync-po` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | DIM-02 | unit | `npx vitest run location-tracking` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 2 | DIM-04 | unit | `npx vitest run pm-auto-invoice` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | DASH-04 | unit | `npx vitest run token-check-cron` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 3 | RPT-01, RPT-02 | unit | `npx vitest run qbo-reports` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 4 | RPT-01, RPT-02 | manual | Visual inspection | N/A | ⬜ pending |
| 06-04-02 | 04 | 4 | DASH-04 | manual | Visual inspection | N/A | ⬜ pending |
| 06-05-01 | 05 | 5 | ALL | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/lib/qbo/mapper-phase6.test.ts` — stubs for PO-01 (toQboPurchaseOrder mapper)
- [ ] `src/__tests__/lib/qbo/sync-po.test.ts` — stubs for PO-01 (syncPurchaseOrderToQbo)
- [ ] `src/__tests__/lib/qbo/location-tracking.test.ts` — stubs for DIM-02 (resolveOrCreateQboLocation)
- [ ] `src/__tests__/lib/qbo/pm-auto-invoice.test.ts` — stubs for DIM-04 (PM auto-invoice hook)
- [ ] `src/__tests__/lib/qbo/qbo-reports.test.ts` — stubs for RPT-01, RPT-02 (report normalization)
- [ ] `src/__tests__/lib/qbo/token-check-cron.test.ts` — stubs for DASH-04 (token expiry monitoring)
- [ ] `src/__tests__/lib/qbo/flush-phase6.test.ts` — stubs for PO-01 (dispatcher routing)

*Existing vitest infrastructure covers all phase requirements — no new dependencies needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QBO Financial tab renders charts | RPT-01 | Recharts visual rendering | Navigate to Analytics > QBO Financial tab, verify 3 reports render |
| Cash/Accrual toggle changes data | RPT-02 | Visual data comparison | Toggle Cash/Accrual, verify report numbers change |
| Location warning banner displays | DIM-02 | CSS rendering | View QBO Health when locationTrackingEnabled=false |
| Token expired red banner displays | DASH-04 | CSS rendering | View QBO Health when connection isActive=false |
| Red dot on integrations page | DASH-04 | CSS rendering | View Settings > Integrations when connection inactive |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
