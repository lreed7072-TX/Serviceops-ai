# Roadmap: ServiceOpsIQ — v2.0 AI Features + CRM Module

## Milestones

- ✅ **v1.0 QBO Full Integration** — Phases 1-6 (shipped 2026-03-10)
- 🔄 **v2.0 AI Features + CRM Module** — AI validated, CRM 85% built, gap-fill in progress

## v2.0 AI Features (VALIDATED — no phases needed)

All AI work shipped prior to milestone formalization:
- 9 requirements (AI-01 – AI-09): Built, tested, hardened, committed
- 5 modules: ai-engine, ai-prompts, ai-queue, ai-triggers, ai-copilot + copilot-tools + anthropic
- 7 UI components: AiRiskBadge, AiInsightsCard, AiAlertsWidget, AiSuggestedTechBadge, AiDraftSummary, AiQuoteSuggestions, AiCopilot
- 6 API routes + 1 cron job
- 25 tests across 4 test files
- 9 hardening fixes committed

## v2.0 CRM Module — Reconciled Status (2026-03-16)

### Pre-existing CRM Code (committed before v2.0 planning)

A previous session built the CRM module extensively. This code was committed to main
in 7 CRM-related commits before the v2.0 milestone was formalized:

| Commit | Description |
|--------|-------------|
| b1b0d27 | CRM integration design document |
| d51fd00 | CRM implementation plan |
| c733119 | CRM schema — 9 models, 10 enums, SALES role |
| 6f16274 | CRM API routes — 26 endpoints |
| 5e24c5c | Sales web pages — 12 pages, layout, sidebar |
| cf6652b | Fix TS error in follow-ups API |
| 2df418d | CRM notification integration |

### Gap-Fill Phase (2026-03-16)

Schema gaps identified and filled:
- [x] Industry lookup model (migration 0011)
- [x] Contact.siteId for site-level contacts (migration 0011)
- [x] Customer.industryId + archivedAt (migration 0011)
- [x] CustomFieldDefinition + CustomFieldValue models (migration 0011)
- [x] CustomFieldEntityType + CustomFieldType enums (migration 0011)

### Completed (42/50 requirements — 84%)

| Category | Status | Details |
|----------|--------|---------|
| CRM Foundation | ✅ Complete | All 7 schema requirements (CRM-01 – CRM-07) |
| Lookup Administration | ✅ 3/4 | LeadSource, CallType, CallOutcome CRUD + settings UI done |
| Contact Management | ✅ 3/5 | CRUD API + customer detail contacts tab done |
| Customer Enhancement | ✅ 2/4 | Tier badges + enrichment edit modal done |
| Activity Tracking | ✅ Complete | All 4 requirements (ACT-01 – ACT-04) |
| Follow-up Management | ✅ Complete | All 4 requirements (FOLL-01 – FOLL-04) |
| Pipeline (Opportunity) | ✅ Complete | All 3 requirements (PIPE-01 – PIPE-03) |
| CRM Dashboard & Reports | ✅ Complete | Dashboard + 5 report sections with Recharts |
| Extra Features | ✅ Complete | Opportunity, ServiceTicket, notifications, FollowUpType, sales layout |

### Remaining Phase: CRM Polish & Custom Fields (8 items)

**Goal:** Fill remaining UI gaps and build custom field system
**Requirements:** LOOK-04, CONT-04, CONT-05, CUST-03, CUST-04, CFIELD-01, CFIELD-02, CFIELD-03
**Status:** Pending

Small items (can be done in any order):
1. **LOOK-04** — Industry CRUD API routes + add to settings page
2. **CONT-04** — Contact quick-add button in call log creation form
3. **CONT-05** — Contact list on Site detail page (siteId filtering)
4. **CUST-03** — Customer archive/restore UI (archivedAt field exists)
5. **CUST-04** — Industry picker in customer CRM edit modal

Custom Fields system (sequential):
6. **CFIELD-01** — Custom field definition admin API + UI
7. **CFIELD-02** — Dynamic custom field rendering on customer/site forms
8. **CFIELD-03** — Custom field value CRUD API

## Progress

| Phase | Milestone | Requirements | Status |
|-------|-----------|-------------|--------|
| AI (validated) | v2.0 | 9 (AI-01 – AI-09) | ✅ Validated |
| CRM (pre-existing) | v2.0 | 42 built / 50 total | ✅ 84% Complete |
| CRM Polish & Custom Fields | v2.0 | 8 remaining | Pending |
| **Total** | | **50** (42 done + 8 pending) | |

<details>
<summary>✅ v1.0 QBO Full Integration (Phases 1-6) — SHIPPED 2026-03-10</summary>

- [x] Phase 1: Foundation (7 plans) — 9 requirements, 7 commits
- [x] Phase 2: Client Extensions + Account Mapping (4 plans) — 4 requirements, 12 commits
- [x] Phase 3: Core Outbound (5 plans) — 13 requirements, 26 commits
- [x] Phase 4: Inbound Sync (4 plans) — 3 requirements, 14 commits
- [x] Phase 5: Enterprise Outbound (4 plans) — 7 requirements, 4 commits
- [x] Phase 6: Enterprise Showcase (5 plans) — 6 requirements, 5 commits

**Total: 42 requirements, 29 plans, 68 commits**

See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

</details>

---
*Created: 2026-03-11 | Reconciled: 2026-03-16 | CRM gap-fill migration applied*
