# Requirements: ServiceOpsIQ — v2.0 AI Features + CRM Module

**Defined:** 2026-03-11
**Reconciled:** 2026-03-16 (audit revealed CRM code pre-existed planning docs)
**Core Value:** AI insights on every mutation + CRM captures every customer interaction

---

## AI Features (VALIDATED — shipped 2026-03-11)

All AI requirements have been built, tested, and committed. No phases needed.

- [x] **AI-01**: Event-driven AI insight pipeline — data mutations enqueue AiInsightJob → cron processes → Claude generates insights → stored as AiInsight with severity/category
- [x] **AI-02**: AI insight queue processing — cron job every 2 minutes claims batch, builds domain context (asset/WO/scheduling/quote), calls Claude, stores results with token tracking
- [x] **AI-03**: AI risk badges — severity-colored badges on assets and entities showing AI-assessed risk level
- [x] **AI-04**: AI insights card — expandable insight list on detail pages with acknowledge action
- [x] **AI-05**: AI alerts widget — dashboard widget showing HIGH/CRITICAL alerts with counts
- [x] **AI-06**: AI suggested tech badge — work order technician recommendation based on skills, availability, proximity
- [x] **AI-07**: AI draft summaries — AI-generated report drafts for completed work orders
- [x] **AI-08**: AI quote suggestions — quote line item suggestions panel based on work order context
- [x] **AI-09**: AI copilot — floating chat sidebar with multi-turn conversation, tool-calling (10 DB query tools), conversation history persistence

---

## CRM Module (adapted from SalesIQ — reconciled 2026-03-16)

### CRM Foundation

- [x] **CRM-01**: Prisma schema — Contact model under Customer with optional siteId, firstName, lastName, title, email, phone, mobilePhone, preferredContactMethod (phone/email/text), isDecisionMaker, isTechnicalInfluencer, isGatekeeper booleans, isPrimary, notes, status, createdByUserId
- [x] **CRM-02**: Prisma schema — CallLog model with userId, customerId, siteId, contactId, callTypeId, callOutcomeId, callMethod (phone/in_person/video_call/email), callDuration, competitorMentioned, notes, callTimestamp
- [x] **CRM-03**: Prisma schema — FollowUp model with callLogId, customerId, siteId, contactId, assignedToUserId, createdByUserId, title, description, dueDate, priority (hot/normal/low), status (pending/completed), completedAt, reminderSent
- [x] **CRM-04**: Prisma schema — Lookup tables: Industry (name, displayOrder, isActive), LeadSource (name, displayOrder, isActive, isDefault), CallType (name, displayOrder, isActive, isDefault), CallOutcome (name, displayOrder, isActive, isDefault, triggersFollowUp, triggersOpportunityPrompt)
- [x] **CRM-05**: Prisma schema — CustomFieldDefinition (entityType, industryId, fieldName, fieldType, displayOrder, isActive) + CustomFieldValue (fieldDefinitionId, entityType, entityId, value)
- [x] **CRM-06**: Customer model enrichment — tier (A/B/C), industryId (FK), leadSourceId (FK), assignedToUserId (FK), archivedAt (soft delete)
- [x] **CRM-07**: Pipeline tracking via Opportunity model — name, amount, status (6 stages), expectedCloseDate, wonLostAt, wonLostReason, convertedQuoteId. Design decision: Opportunity is the CRM pipeline entity; Quote stays operational/financial.

### Lookup Administration

- [x] **LOOK-01**: Lead Source admin CRUD — GET/POST API at /api/crm/lead-sources, PUT/DELETE at /api/crm/lead-sources/[id], per-org isolation, ADMIN role required for writes
- [x] **LOOK-02**: Call Type + Call Outcome admin CRUD — same pattern at /api/crm/call-types and /api/crm/call-outcomes, trigger flags (triggersFollowUp, triggersOpportunityPrompt) on CallOutcome, default selection support
- [x] **LOOK-03**: Lookup management UI — /sales/settings page with expandable config sections for all 4 lookup types (CallTypes, CallOutcomes, FollowUpTypes, LeadSources), add/edit/delete with modals, active toggle
- [x] **LOOK-04**: Industry admin CRUD — API routes + settings UI for Industry lookup

### Contact Management

- [x] **CONT-01**: Contact CRUD API — GET/POST at /api/contacts, GET/PUT/DELETE at /api/contacts/[id], scoped to org, search by name/email, paginated list, role-based access
- [x] **CONT-02**: Contact roles UI — decision maker, technical influencer, gatekeeper, primary toggle badges on customer detail contacts tab
- [x] **CONT-03**: Contact management on Customer detail — contacts tab with grid of contact cards, add/edit modals with all fields, role toggles
- [x] **CONT-04**: Contact quick-add from call log — inline form during call log creation to add a new contact without leaving the flow
- [x] **CONT-05**: Contact list on Site detail page — contact cards filtered by siteId

### Customer Enhancement

- [x] **CUST-01**: Customer tier UI — tier badges (colored) on customer list, tier selector in CRM edit modal on customer detail
- [x] **CUST-02**: Customer enrichment fields UI — lead source picker, assigned rep picker on customer detail CRM edit modal
- [x] **CUST-03**: Customer archiving — Archive/Restore button on detail, "Show Archived" toggle on list, archivedAt filter on GET API
- [x] **CUST-04**: Industry picker — industry dropdown on customer CRM edit modal + fixed PUT API for all CRM fields

### Activity Tracking

- [x] **ACT-01**: Call log CRUD API — GET/POST at /api/call-logs, GET/PUT at /api/call-logs/[id], with all associations, paginated, filterable by date/customer, role-based filtering (SALES see own only)
- [x] **ACT-02**: Call log creation form — /sales/calls/new with customer search (debounced), site/contact cascade pickers, call type/outcome dropdowns from lookups, duration tracker, competitor toggle, notes
- [x] **ACT-03**: Call outcome auto-triggers — outcome triggersFollowUp → auto-shows follow-up creation modal; triggersOpportunityPrompt → auto-shows opportunity creation modal. Both can cascade.
- [x] **ACT-04**: Activity timeline — customer detail page has call history tab showing chronological call logs + opportunities tab + service tickets tab (separate tabs rather than unified timeline)

### Follow-up Management

- [x] **FOLL-01**: Follow-up CRUD API — GET/POST at /api/follow-ups, GET/PUT/DELETE at /api/follow-ups/[id], filterable by status/priority/assignee, paginated, role-based (SALES see own)
- [x] **FOLL-02**: Follow-up list view — /sales/follow-ups page with status tabs (All/Pending/Completed), priority filter, overdue/due-today highlighting, stats bar (total/pending/overdue/completed)
- [x] **FOLL-03**: Follow-up notifications — CRM dashboard API auto-creates FOLLOW_UP_DUE notifications for overdue follow-ups, marks reminderSent to prevent spam
- [x] **FOLL-04**: Follow-up completion — "Complete" button in follow-up list, sets completedAt via PUT

### Pipeline (via Opportunity model)

- [x] **PIPE-01**: Opportunity pipeline view — /sales/opportunities with search, stage filter tabs (Prospecting/Qualification/Proposal/Negotiation/Won/Lost), amounts displayed
- [x] **PIPE-02**: Opportunity detail — /sales/opportunities/[id] with visual stage stepper, Mark Won/Lost modals with reason capture, Convert to Quote action, edit modal
- [x] **PIPE-03**: Pipeline value aggregation — CRM dashboard API aggregates opportunities by status with count and value sum; reports page has pipeline summary with value-by-stage chart

### Custom Fields

- [ ] **CFIELD-01**: Custom field definition admin — create/edit/deactivate field definitions per entity type (customer/site), per industry (optional), field types: text, number, boolean. Schema ready, API/UI not built.
- [ ] **CFIELD-02**: Custom field rendering — dynamically render custom fields on customer and site edit forms based on entity's industry, ordered by displayOrder
- [ ] **CFIELD-03**: Custom field value CRUD — save/update/delete custom field values via API, displayed in detail views

### CRM Dashboard & Reports

- [x] **CDASH-01**: CRM dashboard — /sales/dashboard with KPI stat cards (calls this week, open follow-ups, overdue, pipeline value, open tickets), recent activity, pipeline breakdown, quick action buttons
- [x] **CDASH-02**: CRM reports — /sales/reports with 5 report sections: call activity (bar chart + tables), follow-up performance (stacked bar by rep), pipeline summary (horizontal bars by stage), win/loss analysis (donut + reasons table), customer coverage (by tier). Uses Recharts. Date range + user filter.

### Additional (discovered during build, not in original plan)

- [x] **EXTRA-01**: Opportunity model — full opportunity lifecycle (Prospecting → Qualification → Proposal → Negotiation → Won/Lost) with API, detail page, stage stepper, quote conversion
- [x] **EXTRA-02**: Service Ticket model — intake tickets with urgency, contact snapshotting, convert-to-work-order flow, full CRUD API + list/detail/create UI
- [x] **EXTRA-03**: CRM notification integration — notifications for opportunity won/lost, new service tickets, overdue follow-ups
- [x] **EXTRA-04**: FollowUpType lookup table — additional configurable lookup not in original plan
- [x] **EXTRA-05**: Sales layout + sidebar — /sales/ route group with dedicated layout, navigation sidebar

---

## Requirement Summary

| Category | IDs | Count | Done | Remaining |
|----------|-----|-------|------|-----------|
| AI Features | AI-01 – AI-09 | 9 | 9 | 0 |
| CRM Foundation | CRM-01 – CRM-07 | 7 | 7 | 0 |
| Lookup Administration | LOOK-01 – LOOK-04 | 4 | 4 | 0 |
| Contact Management | CONT-01 – CONT-05 | 5 | 5 | 0 |
| Customer Enhancement | CUST-01 – CUST-04 | 4 | 4 | 0 |
| Activity Tracking | ACT-01 – ACT-04 | 4 | 4 | 0 |
| Follow-up Management | FOLL-01 – FOLL-04 | 4 | 4 | 0 |
| Pipeline (Opportunity) | PIPE-01 – PIPE-03 | 3 | 3 | 0 |
| Custom Fields | CFIELD-01 – CFIELD-03 | 3 | 0 | 3 |
| CRM Dashboard & Reports | CDASH-01 – CDASH-02 | 2 | 2 | 0 |
| Extra (discovered) | EXTRA-01 – EXTRA-05 | 5 | 5 | 0 |
| **Total** | | **50** | **47** | **3** |

## Remaining Work (3 items — Custom Fields system)

1. **CFIELD-01**: Custom field definition admin (API + UI)
2. **CFIELD-02**: Custom field rendering on forms
3. **CFIELD-03**: Custom field value CRUD API

---
*Created: 2026-03-11 | Reconciled: 2026-03-16*
