# AI Features Full Suite — Design Document

**Date:** 2026-03-10
**Status:** Approved
**Milestone:** v2.0

## Overview

Full AI integration for ServiceOpsIQ using event-driven architecture with Claude API. Five modules: Core Engine, AI Copilot, Predictive Maintenance, Smart Scheduling, and AI Reports/Quoting. All insights embedded inline throughout existing UI.

## Architecture: Event-Driven AI Pipeline

```
Data Event → enqueueAiAnalysis() → AiInsightJob (queue) → /api/cron/ai-process (2min)
  → Build context → Call Claude → Parse response → Store AiInsight
  → If severity >= HIGH → Create Notification
  → UI fetches insights per entity
```

Reuses proven QboSyncJob queue pattern: priority levels, stale lock detection, retry with dead_letter.

## Data Models

### AiInsightJob (Durable Queue)
- id, orgId, triggerEvent, entityType, entityId
- priority (1=critical, 5=normal, 9=background)
- status (pending → claimed → completed/failed/dead_letter)
- payload (Json), result (Json)
- claimedAt, completedAt, failedAt, attempts, lastError

### AiInsight (Stored Predictions)
- id, orgId
- insightType: FAILURE_PREDICTION | ANOMALY_DETECTED | SCHEDULING_RECOMMENDATION | MAINTENANCE_FORECAST | QUOTE_SUGGESTION | PERFORMANCE_TREND | INVENTORY_ALERT | REPORT_DRAFT | WORKLOAD_ALERT
- entityType, entityId (polymorphic link)
- severity: LOW | MEDIUM | HIGH | CRITICAL
- title, summary, details (Json)
- confidence (Float, 0.0–1.0)
- actionRecommended, actionTaken
- acknowledgedAt, acknowledgedByUserId
- expiresAt (auto-cleanup)
- llmModel, tokensUsed, durationMs

### AiAnalysisContext (Cached Context)
- id, orgId, entityType, entityId
- contextSnapshot (Json)
- lastAnalyzedAt, lastInsightAt

### AiConversation (Copilot)
- id, orgId, userId, title
- createdAt, lastMessageAt

### AiMessage (Copilot Messages)
- id, conversationId
- role: user | assistant | system
- content (text)
- toolCalls (Json)
- tokensUsed, durationMs

## Module 1: AI Engine Core (P0)

### Files
- `src/lib/ai/ai-engine.ts` — Pipeline orchestrator
- `src/lib/ai/ai-prompts.ts` — Domain-specific system prompts
- `src/lib/ai/ai-queue.ts` — Queue functions (mirrors qbo-queue.ts)
- `src/lib/ai/ai-triggers.ts` — Event trigger dispatch

### Pipeline Flow
1. Data mutation triggers enqueueAiAnalysis(orgId, event, entityType, entityId)
2. AiInsightJob created (pending, priority by event type)
3. Cron `/api/cron/ai-process` (every 2 min) claims batch of 20
4. For each job: build historical context → call Claude → parse → store AiInsight
5. HIGH/CRITICAL severity → create Notification
6. UI fetches via GET /api/ai/insights?entityType=X&entityId=Y

### Trigger Events
| Event | Priority | Module |
|-------|----------|--------|
| work_order.completed | 5 | Predictive Maintenance, Reports |
| measurement.recorded | 5 | Predictive Maintenance |
| finding.created | 3 | Predictive Maintenance |
| pm_schedule.executed | 5 | Predictive Maintenance |
| work_order.created | 3 | Smart Scheduling |
| quote.created | 5 | Intelligent Quoting |
| quote.sent | 9 | Intelligent Quoting |

### API Routes
- `GET /api/ai/insights` — fetch insights (filtered by entity, type, severity)
- `PATCH /api/ai/insights/[id]/acknowledge` — mark insight as acknowledged
- `GET /api/cron/ai-process` — cron job (process 20 jobs/batch)
- `GET /api/ai/stats` — AI usage metrics (tokens, costs, insight counts)

## Module 2: AI Copilot (P1)

### Architecture
Floating chat interface. Claude uses tool calling to query org data on-demand rather than stuffing context.

### Internal Tools (Claude Tool Definitions)
- searchAssets(query) — find assets by name, serial, site
- getWorkOrders(filters) — by asset, customer, status, date range
- getMeasurements(assetId, limit) — historical measurements
- getFindings(filters) — field observations
- getTimeEntries(filters) — labor history
- getPMSchedules(assetId) — upcoming maintenance
- getQuotes/getInvoices(filters) — financial context
- getAiInsights(entityType, entityId) — existing predictions
- searchKnowledgeBase(query) — RAG over org documents
- getCustomerHistory(customerId) — interaction timeline

### UI
- Floating chat bubble (bottom-right, collapsible)
- Expandable sidebar (~400px)
- Context-aware: auto-includes current page entity
- Conversation history, searchable
- Quick actions: suggest creating WO, scheduling PM, generating quote (with confirm)

### API Routes
- `POST /api/ai/chat` — send message, streaming response
- `GET /api/ai/conversations` — list user conversations
- `GET /api/ai/conversations/[id]/messages` — message history
- `DELETE /api/ai/conversations/[id]` — delete conversation

## Module 3: Predictive Maintenance (P1)

### Context Built per Analysis
1. Asset profile (type, age, criticality, nameplate)
2. Work history (last 20 WOs — type, findings, duration)
3. Measurement trends (last 50 with min/max specs)
4. PM compliance (schedule adherence, last 10 results)
5. Similar assets (same make/model failure patterns across org)

### Insight Types
- FAILURE_PREDICTION — estimated days to failure, confidence, recommended action
- ANOMALY_DETECTED — out-of-spec measurement, possible causes, severity
- MAINTENANCE_FORECAST — optimal PM interval vs current setting

### UI Placement
- Asset detail page: Risk score badge (green/yellow/orange/red) + prediction card
- Dashboard: "AI Alerts" widget (HIGH/CRITICAL insights)
- PM schedule page: "AI Recommended" intervals
- Work order page: Related predictions for serviced asset

## Module 4: Smart Scheduling (P2)

### Context Built per Analysis
1. Tech profiles (skills, certs, equipment experience, location)
2. Current workload (active WOs, hours this week)
3. Historical performance (avg time by WO type, first-fix rate)
4. Geography (tech base vs job site)
5. Asset expertise (which techs have worked on this asset/family)

### Insight Types
- SCHEDULING_RECOMMENDATION — ranked tech suggestions with reasoning
- WORKLOAD_ALERT — overloaded tech detection

### UI Placement
- WO creation: "AI Suggested" badge on tech dropdown
- Analytics: Tech utilization with AI optimization score

## Module 5: AI Reports & Quoting (P3)

### Report Generation
- After WO completion: Claude drafts executive summary from tasks, findings, measurements, photos
- Auto-populates report templates
- Flags safety issues prominently

### Intelligent Quoting
- Quote creation: Claude suggests line items from similar past quotes, historical labor hours, material costs
- Quote confidence score based on historical win rate

### Insight Types
- REPORT_DRAFT — auto-generated summary for completed WOs
- QUOTE_SUGGESTION — recommended line items + acceptance probability

## Implementation Phases

| Phase | Name | Priority | Modules |
|-------|------|----------|---------|
| 1 | AI Engine Core | P0 | Schema, queue, pipeline, triggers, cron, insights API |
| 2 | Predictive Maintenance | P1 | Prompts, context builders, UI badges/cards, dashboard widget |
| 3 | AI Copilot | P1 | Chat models, tool definitions, streaming API, floating UI |
| 4 | Smart Scheduling | P2 | Tech analysis, scheduling prompts, WO assignment UI |
| 5 | AI Reports & Quoting | P3 | Report drafting, quote suggestions, confidence scoring |

## Technical Constraints

- All Claude calls use claude-sonnet-4-20250514 (already integrated)
- Max 4096 tokens per insight analysis, 8192 for copilot conversations
- Serverless: all processing within Vercel function limits (10s default, 60s max for cron)
- Multi-tenant: every insight scoped to orgId
- Cost tracking: tokensUsed + durationMs on every AI interaction
- Insights expire after 30 days (configurable) — auto-cleanup via cron

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Event-driven queue over on-demand | Proactive alerts need pre-computed insights; matches proven QBO pattern |
| Claude for all inference | Already integrated; no additional model dependencies |
| Tool calling for copilot | Avoids stuffing entire DB into prompt; Claude queries what it needs |
| Polymorphic entityType+entityId | Single AiInsight table serves all entity types |
| 2-min cron cycle | Balance between freshness and API cost |
| Embedded UI over dedicated AI section | Lower friction; insights appear where decisions are made |
