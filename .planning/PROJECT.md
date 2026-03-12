# ServiceOpsIQ — v2.0 AI Features + CRM Module

## What This Is

ServiceOpsIQ is an enterprise multi-tenant SaaS for rotating equipment service management. v2.0 adds intelligent AI-powered insights across the platform and a full CRM module for customer relationship management — contacts, activity tracking, follow-ups, pipeline management, and configurable lookups — adapted from the proven SalesIQ CRM system.

## Core Value

**AI Features:** Every data mutation generates intelligent insights — predictive maintenance alerts, technician recommendations, quote suggestions, and draft summaries — so dispatchers and managers make faster, better-informed decisions.

**CRM Module:** Every customer interaction is captured and tracked — contacts, call logs, follow-ups, and pipeline — so GPS never loses a lead, misses a follow-up, or forgets a customer conversation.

## Current State

**Stack:** Next.js 16.1, React 19, TypeScript 5, Prisma 6.16, Supabase, Vercel
**v1.0 QBO:** Shipped 2026-03-10 — 42 requirements, 68 commits, 250 tests
**v2.0 AI:** Shipped 2026-03-11 — 9 requirements validated, 25 tests, 5 modules
**v2.0 CRM:** In progress — adapted from SalesIQ CRM codebase

## AI Features (VALIDATED)

All AI features have been built, tested, and committed:
- Event-driven AI insight pipeline (data mutations → queue → Claude → insights)
- AI Copilot with tool-calling chat (10 DB query tools)
- AI components: RiskBadge, InsightsCard, AlertsWidget, SuggestedTechBadge, DraftSummary, QuoteSuggestions, Copilot
- AI API routes: chat, insights, stats, conversations
- AI cron: `/api/cron/ai-process` every 2 minutes
- 25 tests across 4 test files
- 9 hardening fixes (rate limiting, validation, accessibility, cache headers)

## CRM Module (NEW — from SalesIQ analysis)

Source: SalesIQ-Agent codebase (Express + Drizzle, 524-line schema, 20+ tables)
Pattern: Adapt proven CRM patterns to ServiceOpsIQ's Prisma + Next.js stack

### New entities:
- **Contact** — under Site (Customer → Site → Contact hierarchy), with roles and preferred contact method
- **CallLog** — interaction tracking with customer/site/contact associations
- **FollowUp** — post-activity tasks with priority, due dates, auto-creation from call outcomes
- **Lookup tables** — Industry, LeadSource, CallType, CallOutcome (all per-org, admin-configurable)
- **CustomFieldDefinition + CustomFieldValue** — flexible field system per entity type

### Enrichments to existing models:
- **Customer** — tier (A/B/C), industryId, leadSourceId, assignedToUserId, archivedAt
- **Quote** — expectedCloseDate, wonLostAt, wonLostReason (pipeline tracking)

### Dashboard additions:
- CRM KPIs: calls this week, open/overdue follow-ups, pipeline value, customer count by tier

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Claude API only (claude-sonnet-4) | No local models, consistent quality | Validated |
| Event-driven AI pipeline | Mirrors QBO queue pattern, fire-and-forget | Validated |
| Contact under Site (not Customer) | Matches GPS field reality — contacts are at sites | Decided |
| SalesIQ lookup pattern | Proven admin-configurable lookups, per-org isolation | Decided |
| Customer tiers (A/B/C) | Simple prioritization, matches SalesIQ | Decided |
| Call outcome triggers | Auto-create follow-ups, prompt quotes — proven UX | Decided |
| Custom fields per entity type | Flexible without schema changes, industry-specific | Decided |
| No Outlook calendar sync | Defer to future — focus on core CRM first | Decided |
| No Teams model | Use existing User roles — defer team hierarchy | Decided |

## Constraints

- **Multi-tenancy:** All CRM entities must include orgId, all queries scoped
- **RLS:** Supabase Row-Level Security on all new tables
- **Styling:** CSS variables (NOT Tailwind), match existing design system
- **Offline:** CRM is web-only for v2.0 — mobile CRM deferred to v3.0
- **Serverless:** All API routes must complete within Vercel function limits
- **Existing patterns:** Use fetchPaginated, requireAuthSessionFirst, shared UI components

## Out of Scope (v2.0)

- Outlook/Microsoft Graph calendar sync for follow-ups
- Team hierarchy and management
- Mobile CRM (deferred to v3.0)
- Email campaign integration
- Advanced reporting / custom report builder for CRM data
- Lead scoring / AI-powered lead qualification (potential v3.0)

---
*Last updated: 2026-03-11 — v2.0 milestone initialized*
