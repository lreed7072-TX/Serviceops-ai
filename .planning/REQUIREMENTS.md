# Requirements: ServiceOpsIQ — v2.0 AI Features + CRM Module

**Defined:** 2026-03-11
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

## CRM Module (NEW — adapted from SalesIQ)

### CRM Foundation

- [ ] **CRM-01**: Prisma schema — Contact model under Site with firstName, lastName, title, email, phone, mobilePhone, preferredContactMethod (phone/email/text), isDecisionMaker, isTechnicalInfluencer, isGatekeeper booleans, notes, status, createdByUserId
- [ ] **CRM-02**: Prisma schema — CallLog model with userId, customerId, siteId, contactId, callTypeId, callOutcomeId, callMethod (phone/in_person/video_call/email), callDuration, competitorMentioned, notes, callTimestamp
- [ ] **CRM-03**: Prisma schema — FollowUp model with callLogId, customerId, siteId, contactId, assignedToUserId, createdByUserId, title, description, dueDate, priority (hot/normal/low), status (pending/completed), completedAt, reminderSent
- [ ] **CRM-04**: Prisma schema — Lookup tables: Industry (name, displayOrder, isActive), LeadSource (name, displayOrder, isActive), CallType (name, displayOrder, isActive, isDefault), CallOutcome (name, displayOrder, isActive, isDefault, triggersFollowUp, triggersQuotePrompt)
- [ ] **CRM-05**: Prisma schema — CustomFieldDefinition (entityType, industryId, fieldName, fieldType, displayOrder, isActive) + CustomFieldValue (fieldDefinitionId, entityType, entityId, value)
- [ ] **CRM-06**: Customer model enrichment — add tier (A/B/C, default B), industryId (FK), leadSourceId (FK), assignedToUserId (FK), archivedAt (soft delete)
- [ ] **CRM-07**: Quote model enrichment — add expectedCloseDate, wonLostAt, wonLostReason for pipeline tracking

### Lookup Administration

- [ ] **LOOK-01**: Industry + Lead Source admin CRUD — GET/POST/PATCH/DELETE API routes, per-org isolation, display order management, active/inactive toggle
- [ ] **LOOK-02**: Call Type + Call Outcome admin CRUD — same as LOOK-01 plus trigger flags (triggersFollowUp, triggersQuotePrompt) on CallOutcome, default selection support
- [ ] **LOOK-03**: Lookup management UI — settings page with tabbed admin for all 4 lookup types, drag-to-reorder, add/edit/deactivate, seed default values on first use

### Contact Management

- [ ] **CONT-01**: Contact CRUD API — GET/POST/PATCH/DELETE /api/contacts, scoped to customer/site, search by name/email/phone, paginated list
- [ ] **CONT-02**: Contact roles UI — decision maker, technical influencer, gatekeeper toggle badges on contact cards, filterable by role
- [ ] **CONT-03**: Contact list on Site detail page — contact cards with quick actions (call, email), add contact button, role indicators
- [ ] **CONT-04**: Contact quick-add from call log — inline form during call log creation to add a new contact without leaving the flow

### Customer Enhancement

- [ ] **CUST-01**: Customer tier UI — A/B/C tier badge on customer list and detail, tier selector on customer edit, sortable/filterable by tier
- [ ] **CUST-02**: Customer enrichment fields UI — industry picker, lead source picker, assigned user picker on customer edit form
- [ ] **CUST-03**: Customer archiving — soft delete with archivedAt timestamp, "Archive" action (not delete), admin "View Archived" toggle, restore action

### Activity Tracking

- [ ] **ACT-01**: Call log CRUD API — GET/POST/PATCH /api/call-logs, with customer/site/contact/callType/callOutcome associations, paginated, filterable by date/customer/type
- [ ] **ACT-02**: Call log creation form — customer/site/contact cascade pickers, call type and outcome dropdowns (from lookups), duration tracker, competitor mentioned toggle, notes
- [ ] **ACT-03**: Call outcome auto-triggers — when outcome has triggersFollowUp=true, auto-create FollowUp linked to call log; when triggersQuotePrompt=true, redirect to quote creation with customer/site pre-filled
- [ ] **ACT-04**: Activity timeline — chronological feed on customer and site detail pages showing call logs, follow-ups, quotes, and work orders in unified timeline

### Follow-up Management

- [ ] **FOLL-01**: Follow-up CRUD API — GET/POST/PATCH/DELETE /api/follow-ups, scoped to customer, filterable by status/priority/assignee/due date, paginated
- [ ] **FOLL-02**: Follow-up list view — dedicated page with overdue highlighting (red), due-today highlighting (orange), priority badges (hot/normal/low), assignee avatar
- [ ] **FOLL-03**: Follow-up notifications — create Notification (type: FOLLOW_UP_DUE) for assigned user when follow-up due date is today, mark reminderSent
- [ ] **FOLL-04**: Follow-up completion — one-click complete from list and detail views, sets completedAt, optionally prompts for completion notes

### Pipeline Enhancement

- [ ] **PIPE-01**: Quote pipeline view — kanban or list view showing quotes by status (pending/won/lost) with expected close dates, amounts, customer names
- [ ] **PIPE-02**: Quote enrichment UI — expectedCloseDate picker, won/lost recording with reason field, pipeline amount display
- [ ] **PIPE-03**: Pipeline value aggregation — total pipeline value (pending quotes), won value (period), lost value (period), conversion rate calculation

### Custom Fields

- [ ] **CFIELD-01**: Custom field definition admin — create/edit/deactivate field definitions per entity type (customer/site), per industry (optional), field types: text, number, boolean
- [ ] **CFIELD-02**: Custom field rendering — dynamically render custom fields on customer and site edit forms based on entity's industry, ordered by displayOrder
- [ ] **CFIELD-03**: Custom field value CRUD — save/update/delete custom field values via API, displayed in detail views

### CRM Dashboard

- [ ] **CDASH-01**: CRM KPI widgets — calls this week, open follow-ups, overdue follow-ups, total pipeline value, customer count by tier, displayed on main dashboard as new CRM section
- [ ] **CDASH-02**: CRM analytics tab — dedicated tab on analytics page with call volume trends, follow-up completion rates, pipeline funnel, customer acquisition by source

---

## Requirement Summary

| Category | IDs | Count | Status |
|----------|-----|-------|--------|
| AI Features | AI-01 – AI-09 | 9 | VALIDATED |
| CRM Foundation | CRM-01 – CRM-07 | 7 | Pending |
| Lookup Administration | LOOK-01 – LOOK-03 | 3 | Pending |
| Contact Management | CONT-01 – CONT-04 | 4 | Pending |
| Customer Enhancement | CUST-01 – CUST-03 | 3 | Pending |
| Activity Tracking | ACT-01 – ACT-04 | 4 | Pending |
| Follow-up Management | FOLL-01 – FOLL-04 | 4 | Pending |
| Pipeline Enhancement | PIPE-01 – PIPE-03 | 3 | Pending |
| Custom Fields | CFIELD-01 – CFIELD-03 | 3 | Pending |
| CRM Dashboard | CDASH-01 – CDASH-02 | 2 | Pending |
| **Total** | | **42** | 9 validated, 33 pending |

---
*Created: 2026-03-11*
