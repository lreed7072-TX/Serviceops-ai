# Milestones

## v1.0 QBO Full Integration (Shipped: 2026-03-10)

**Phases:** 6 | **Plans:** 29 | **Commits:** 68 | **Requirements:** 42/42
**Timeline:** 2026-03-08 → 2026-03-10 (3 days)
**Files changed:** 114 | **Lines added:** 27,228
**Tests:** 250 total (163 QBO-specific across 18 test files)

**Key accomplishments:**
1. Fixed 3 live data-corruption bugs (token refresh race, sparse update, decimal rounding) and built core infrastructure (types, mappers, queue)
2. Built Chart of Accounts mapping UI with prerequisite gate that blocks financial syncs until configured
3. Delivered 13 core outbound sync requirements: payment processing, item/quote/invoice sync with ItemRef + LinkedTxn, webhook rewrite, integration health dashboard
4. Implemented bidirectional sync: CDC polling engine (4h cycle), inbound customer sync with conflict resolution, invoice void bidirectional flow
5. Enterprise outbound: vendor/employee/time activity/expense sync, class tracking on all transactions, credit memo creation
6. Enterprise showcase: PO sync, location/department tracking, QBO Reports API (P&L, A/R Aging, Balance Sheet), PM auto-invoicing, proactive token expiry monitoring

**Archives:**
- [Roadmap](milestones/v1.0-ROADMAP.md)
- [Requirements](milestones/v1.0-REQUIREMENTS.md)

---

## v2.0 AI Features + CRM Module (In Progress: 2026-03-11 →)

**AI Features:** VALIDATED — 9 requirements, 25 tests, 5 modules, 7 components, 9 hardening fixes
**CRM Module:** 5 phases planned, 33 requirements defined
**Total v2.0 requirements:** 42 (9 validated + 33 pending)

**AI accomplishments (pre-milestone):**
1. Event-driven AI insight pipeline: data mutations → queue → Claude → insights with severity/category
2. AI Copilot: multi-turn tool-calling chat with 10 DB query tools
3. 7 UI components: RiskBadge, InsightsCard, AlertsWidget, SuggestedTechBadge, DraftSummary, QuoteSuggestions, Copilot
4. 6 API routes + AI cron job (every 2 min)
5. 9 hardening fixes: rate limiting, input validation, accessibility, cache headers, token budget guard

**CRM scope (from SalesIQ analysis):**
1. CRM Foundation — schema migration for Contact, CallLog, FollowUp, lookups, custom fields, customer/quote enrichment
2. Lookups + Contact Management — admin lookup config, contact CRUD with roles
3. Activity & Follow-up Tracking — call logs, auto-triggers, timeline, follow-up lifecycle
4. Customer Enhancement + Pipeline — tiers, archiving, quote pipeline views
5. Custom Fields + CRM Dashboard — flexible fields, KPI widgets, analytics tab

---
