# Roadmap: ServiceOpsIQ — v2.0 AI Features + CRM Module

## Milestones

- ✅ **v1.0 QBO Full Integration** — Phases 1-6 (shipped 2026-03-10)
- 🔄 **v2.0 AI Features + CRM Module** — AI validated, CRM Phases 1-5 (in progress)

## v2.0 AI Features (VALIDATED — no phases needed)

All AI work shipped prior to milestone formalization:
- 9 requirements (AI-01 – AI-09): Built, tested, hardened, committed
- 5 modules: ai-engine, ai-prompts, ai-queue, ai-triggers, ai-copilot + copilot-tools + anthropic
- 7 UI components: AiRiskBadge, AiInsightsCard, AiAlertsWidget, AiSuggestedTechBadge, AiDraftSummary, AiQuoteSuggestions, AiCopilot
- 6 API routes + 1 cron job
- 25 tests across 4 test files
- 9 hardening fixes committed

## v2.0 CRM Module Phases

### Phase 1: CRM Foundation
**Goal:** Schema migration + types + base models for all CRM entities
**Requirements:** CRM-01, CRM-02, CRM-03, CRM-04, CRM-05, CRM-06, CRM-07
**Status:** Pending

Prisma schema additions:
- Contact, CallLog, FollowUp models with full field sets
- Industry, LeadSource, CallType, CallOutcome lookup tables
- CustomFieldDefinition + CustomFieldValue
- Customer enrichment fields (tier, industryId, leadSourceId, assignedToUserId, archivedAt)
- Quote enrichment fields (expectedCloseDate, wonLostAt, wonLostReason)
- All foreign keys, indexes, enums, and org scoping

### Phase 2: Lookups + Contact Management
**Goal:** Admin lookup configuration + contact CRUD with roles
**Requirements:** LOOK-01, LOOK-02, LOOK-03, CONT-01, CONT-02, CONT-03, CONT-04
**Status:** Pending

- API routes for all 4 lookup types (Industry, LeadSource, CallType, CallOutcome)
- Lookup management settings page (tabbed, reorder, add/edit/deactivate)
- Seed default lookup values on first use
- Contact CRUD API endpoints
- Contact list on Site detail page with role badges
- Contact quick-add flow from call log creation

### Phase 3: Activity & Follow-up Tracking
**Goal:** Call log and follow-up lifecycle with auto-triggers
**Requirements:** ACT-01, ACT-02, ACT-03, ACT-04, FOLL-01, FOLL-02, FOLL-03, FOLL-04
**Status:** Pending

- Call log CRUD API + creation form with cascade pickers
- Call outcome auto-triggers (follow-up creation, quote prompt)
- Activity timeline on customer/site detail pages
- Follow-up CRUD API + list view with overdue/priority highlighting
- Follow-up notifications (FOLLOW_UP_DUE type)
- Follow-up one-click completion

### Phase 4: Customer Enhancement + Pipeline
**Goal:** Customer tiers, enrichment, archiving, quote pipeline
**Requirements:** CUST-01, CUST-02, CUST-03, PIPE-01, PIPE-02, PIPE-03
**Status:** Pending

- Customer tier badges (A/B/C) on list and detail views
- Customer enrichment form (industry, lead source, assigned user)
- Customer archiving (soft delete, admin restore)
- Quote pipeline view (kanban or list by status)
- Quote enrichment UI (expected close date, won/lost)
- Pipeline value aggregation and metrics

### Phase 5: Custom Fields + CRM Dashboard
**Goal:** Flexible custom fields + CRM KPIs and analytics
**Requirements:** CFIELD-01, CFIELD-02, CFIELD-03, CDASH-01, CDASH-02
**Status:** Pending

- Custom field definition admin (per entity type, per industry)
- Dynamic custom field rendering on customer/site forms
- Custom field value CRUD
- CRM KPI widgets on dashboard (calls, follow-ups, pipeline, tiers)
- CRM analytics tab (call trends, follow-up rates, pipeline funnel, acquisition sources)

## Progress

| Phase | Milestone | Requirements | Status |
|-------|-----------|-------------|--------|
| AI (validated) | v2.0 | 9 (AI-01 – AI-09) | Validated |
| 1. CRM Foundation | v2.0 | 7 (CRM-01 – CRM-07) | Pending |
| 2. Lookups + Contact Management | v2.0 | 7 (LOOK + CONT) | Pending |
| 3. Activity & Follow-up Tracking | v2.0 | 8 (ACT + FOLL) | Pending |
| 4. Customer Enhancement + Pipeline | v2.0 | 6 (CUST + PIPE) | Pending |
| 5. Custom Fields + CRM Dashboard | v2.0 | 5 (CFIELD + CDASH) | Pending |
| **Total** | | **42** (9 validated + 33 pending) | |

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
*Created: 2026-03-11 | v1.0 shipped: 2026-03-10 | v2.0 initialized: 2026-03-11*
