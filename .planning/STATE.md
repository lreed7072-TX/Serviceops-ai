---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: AI Features + CRM Module
status: requirements_gathering
last_updated: "2026-03-11T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: AI Features + CRM Module

## Project Reference
See: .planning/PROJECT.md (updated 2026-03-11)
**Core value:** AI insights on every mutation + CRM captures every customer interaction
**Status:** v2.0 milestone initialized — defining requirements

## AI Features (VALIDATED — no phases needed)

All AI features shipped and committed prior to milestone formalization:

| Module | File | Status |
|--------|------|--------|
| AI Engine | src/lib/ai/ai-engine.ts | Validated |
| AI Prompts | src/lib/ai/ai-prompts.ts | Validated |
| AI Queue | src/lib/ai/ai-queue.ts | Validated |
| AI Triggers | src/lib/ai/ai-triggers.ts | Validated |
| AI Copilot | src/lib/ai/ai-copilot.ts | Validated |
| Copilot Tools | src/lib/ai/copilot-tools.ts | Validated |
| Anthropic Client | src/lib/ai/anthropic.ts | Validated |
| 7 UI Components | src/components/ai/ | Validated |
| 6 API Routes | src/app/api/ai/ | Validated |
| AI Cron | src/app/api/cron/ai-process/ | Validated |
| 25 Tests | src/__tests__/lib/ai/ | Validated |
| 9 Hardening Fixes | Various | Validated |

## CRM Module (NEW — requirements being defined)

Adapted from SalesIQ CRM codebase analysis (crm-integration.md in memory).
Phases and requirements defined in REQUIREMENTS.md and ROADMAP.md.

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
- Contact under Site (Customer → Site → Contact hierarchy)
- SalesIQ lookup pattern (per-org, admin-configurable, display order)
- Customer tiers (A/B/C) for prioritization
- Call outcome triggers (auto follow-up, quote prompt)
- Custom fields per entity type (definition + value pattern)
- No Outlook calendar sync in v2.0
- No Teams model in v2.0

---
*Last updated: 2026-03-11 — v2.0 milestone initialized*
