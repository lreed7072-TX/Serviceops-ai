---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: AI Features + CRM Module
status: executing
last_updated: "2026-03-16T00:00:00.000Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: AI Features + CRM Module

## Project Reference
See: .planning/PROJECT.md (updated 2026-03-11)
**Core value:** AI insights on every mutation + CRM captures every customer interaction
**Status:** v2.0 CRM 84% complete — reconciled 2026-03-16, gap-fill migration applied

## AI Features (VALIDATED — no phases needed)

All AI features shipped and committed prior to milestone formalization.
9 requirements, 25 tests, 0 errors. See REQUIREMENTS.md for details.

## CRM Module (RECONCILED — 2026-03-16)

### What Happened
A previous session built the CRM module extensively (7 commits) before the v2.0
milestone was formalized on 2026-03-11. The planning docs were created without
accounting for this existing code. On 2026-03-16, a full audit was performed:

- **API Routes audit:** 26 endpoints, production-ready, 9/10 quality
- **UI Pages audit:** 12 pages, production-ready, full CRUD workflows
- **Schema audit:** 85% complete, gaps identified and filled

### Gap-Fill (2026-03-16)
- Added Industry lookup model
- Added Contact.siteId (optional, for site-level contacts)
- Added Customer.industryId + archivedAt
- Added CustomFieldDefinition + CustomFieldValue models
- Created + applied migration 0011_crm_gaps_industry_customfields
- Resolved stale migration tracking (0009, 0010 marked as applied)
- Updated REQUIREMENTS.md — reconciled all 50 requirements against actual code
- Updated ROADMAP.md — reflected 42/50 complete

### Remaining (8 items)
1. LOOK-04 — Industry CRUD API + settings UI
2. CONT-04 — Contact quick-add from call log
3. CONT-05 — Contact list on Site detail page
4. CUST-03 — Customer archive/restore UI
5. CUST-04 — Industry picker on customer edit
6. CFIELD-01 — Custom field definition admin
7. CFIELD-02 — Custom field rendering on forms
8. CFIELD-03 — Custom field value CRUD API

## Decisions Log

### AI Decisions (from build phase)
- Event-driven pipeline: data mutations → AiInsightJob queue → cron → Claude → AiInsight
- Mirrors QboSyncJob queue pattern (claim/complete/fail/stale-lock)
- Claude API only (claude-sonnet-4), no local models
- Copilot: tool-calling chat with 10 DB query tools, max 5 iterations
- failAiJob: Atomic SQL UPDATE (no read-modify-write race)
- Token tracking: stored on AiInsightJob only
- Copilot context: newest 20 messages (desc+reverse)

### CRM Decisions
- Contact under Customer with optional siteId (supports both customer-wide and site-specific)
- Opportunity model for pipeline tracking (NOT Quote enrichment) — cleaner separation
- SalesIQ lookup pattern (per-org, admin-configurable, display order)
- Customer tiers (A/B/C) for prioritization
- Call outcome triggers (auto follow-up, opportunity prompt)
- Custom fields per entity type (definition + value pattern), optionally per industry
- No Outlook calendar sync in v2.0
- No Teams model in v2.0
- ServiceTicket as intake entity with convert-to-WorkOrder flow

### Migration Decisions (2026-03-16)
- Migrations 0009 + 0010 were applied to DB but not tracked — marked as resolved
- Single migration 0011 covers all gap-fill additions
- CustomField schema included early (tables sit empty until UI built)

---
*Last updated: 2026-03-16 — CRM reconciled, gap-fill migration applied, 8 items remaining*
