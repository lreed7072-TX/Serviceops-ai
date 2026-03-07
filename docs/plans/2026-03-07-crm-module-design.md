# CRM Module Integration — Design Document

**Date:** 2026-03-07
**Status:** Approved
**Reference:** SalesIQ-Agent codebase at /Volumes/Transcend/SalesIQ-Agent

## Goal

Integrate a full CRM module into ServiceOps that replicates the feature set of the standalone SalesIQ application. Sales team gets their own web route group and mobile tab experience, while sharing the same database, auth, customers, quotes, and work orders with the service side.

## Architecture Decision

**Single integrated codebase.** CRM lives inside ServiceOps as a new `(sales)` route group alongside `(app)` (admin/dispatch), `(tech)` (field techs), and `portal` (customers). Shared Prisma schema, shared Supabase auth, single Vercel deployment.

Rationale: Customers, Sites, Quotes, and Work Orders are shared between sales and service. An Opportunity that converts to a Quote that generates a Work Order is one transaction across one database.

## Role Model

New `SALES` role added to existing Role enum.

| Area | ADMIN | DISPATCHER | SALES | TECH |
|------|-------|------------|-------|------|
| CRM (Contacts, Calls, Follow-ups, Opportunities) | Full | Read-only | Full (own data) | None |
| Customers | Full | Full | Full | Assigned only |
| Service Tickets | Full | Full (convert to WO) | Create + view | None |
| Quotes (ServiceOps) | Full | Full | Read-only | None |
| Work Orders | Full | Full | Read-only | Assigned only |
| Invoices | Full | Full | Read-only | None |
| CRM Settings | Full | None | None | None |
| Sales Reports | All reps | None | Own data only | None |

## Data Model

### New Models

#### Contact
```
Contact {
  id            String   @id @default(cuid())
  orgId         String
  customerId    String   → Customer
  firstName     String
  lastName      String
  title         String?  (job title)
  email         String?
  phone         String?
  mobilePhone   String?
  preferredContactMethod  ContactMethod? (PHONE, EMAIL, TEXT)
  isDecisionMaker         Boolean @default(false)
  isTechnicalInfluencer   Boolean @default(false)
  isGatekeeper            Boolean @default(false)
  isPrimary               Boolean @default(false)
  notes         String?
  status        ContactStatus @default(ACTIVE) (ACTIVE, INACTIVE)
  createdByUserId String? → User
  createdAt     DateTime
  updatedAt     DateTime
}
```

#### CallLog
```
CallLog {
  id            String   @id @default(cuid())
  orgId         String
  userId        String   → User (who made the call)
  customerId    String   → Customer
  siteId        String?  → Site
  contactId     String?  → Contact
  callTypeId    String   → CallType
  callOutcomeId String   → CallOutcome
  callMethod    CallMethod (PHONE, IN_PERSON, VIDEO_CALL, EMAIL)
  callDuration  Int?     (minutes)
  competitorMentioned String?
  notes         String?
  callTimestamp DateTime
  createdAt     DateTime
  updatedAt     DateTime
}
```

#### FollowUp
```
FollowUp {
  id            String   @id @default(cuid())
  orgId         String
  callLogId     String?  → CallLog (if triggered by call)
  customerId    String   → Customer
  siteId        String?  → Site
  contactId     String?  → Contact
  assignedToUserId String → User
  createdByUserId  String → User
  title         String
  description   String?
  dueDate       DateTime
  priority      FollowUpPriority (HOT, NORMAL, LOW)
  status        FollowUpStatus (PENDING, COMPLETED)
  completedAt   DateTime?
  reminderSent  Boolean @default(false)
  outlookEventId String? (reserved for v2 Outlook sync)
  createdAt     DateTime
  updatedAt     DateTime
}
```

#### Opportunity
```
Opportunity {
  id            String   @id @default(cuid())
  orgId         String
  callLogId     String?  → CallLog
  customerId    String   → Customer
  siteId        String?  → Site
  contactId     String?  → Contact
  createdByUserId String → User
  name          String
  description   String?
  amount        Decimal(12,2)?
  status        OpportunityStatus (PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION, WON, LOST)
  expectedCloseDate DateTime?
  wonLostAt     DateTime?
  wonLostReason String?
  convertedQuoteId String? → Quote (bridge to ServiceOps quote system)
  notes         String?
  createdAt     DateTime
  updatedAt     DateTime
}
```

#### ServiceTicket
```
ServiceTicket {
  id            String   @id @default(cuid())
  orgId         String
  createdByUserId String → User
  customerId    String   → Customer
  siteId        String?  → Site
  contactId     String?  → Contact
  contactName   String?  (snapshot)
  contactPhone  String?  (snapshot)
  reasonForService String
  serviceRequestedDate DateTime?
  urgency       TicketUrgency (LOW, NORMAL, HIGH, EMERGENCY)
  notes         String?
  siteAddress   String?
  convertedWorkOrderId String? → WorkOrder
  status        TicketStatus (OPEN, ASSIGNED, CONVERTED, CLOSED)
  completedAt   DateTime?
  createdAt     DateTime
  updatedAt     DateTime
}
```

### Config Tables (org-scoped lookups)

```
CallType       { id, orgId, name, displayOrder, isActive, isDefault }
CallOutcome    { id, orgId, name, triggersFollowUp, triggersOpportunityPrompt, displayOrder, isActive, isDefault }
FollowUpType   { id, orgId, name, displayOrder, isActive, isDefault }
LeadSource     { id, orgId, name, displayOrder, isActive, isDefault }
```

### Existing Model Extensions

**Customer** — add fields:
- `tier: CustomerTier?` (A, B, C)
- `leadSourceId: String?` → LeadSource
- `assignedToUserId: String?` → User (sales rep ownership)
- `createdByUserId: String?` → User

**Role enum** — add `SALES`

## Key Workflows

### 1. Log a Call
1. Salesperson selects customer → optional contact → call type → outcome → notes + duration
2. If outcome.triggersFollowUp → auto-prompts to create follow-up (pre-filled customer/contact)
3. If outcome.triggersOpportunityPrompt → auto-prompts to create opportunity

### 2. Opportunity Pipeline
1. Create from call prompt or standalone
2. Track through stages: Prospecting → Qualification → Proposal → Negotiation → Won/Lost
3. At "Proposal" stage → option to "Create ServiceOps Quote" (creates real Quote, links via convertedQuoteId)
4. When Won → opportunity marked, linked quote can convert to Work Order (existing flow)

### 3. Service Tickets (Sales → Service Bridge)
1. Salesperson creates ticket from customer page or standalone
2. Notification sent to ADMIN + DISPATCHER users
3. Dispatcher reviews → "Convert to Work Order" → pre-fills WO with customer/site/description
4. Ticket status → CONVERTED, links to created WO
5. Salesperson sees ticket status (visibility into service follow-through)

### 4. Sales Dashboard
- Calls this week/month
- Open follow-ups + overdue count
- Pipeline value by stage
- Recent activity feed

### 5. Sales Reports (management)
| Report | Metrics |
|--------|---------|
| Call Activity | Calls by type/outcome/rep, date range |
| Follow-up Performance | Open/overdue/completed, avg completion time by rep |
| Pipeline Summary | Count + value by stage, avg deal size by rep |
| Win/Loss Analysis | Win rate, loss reasons by rep |
| Customer Coverage | Contacted vs untouched, call frequency by rep/tier |

Access: ADMIN sees all reps. SALES sees own data only.

## API Routes

```
# Contacts
GET/POST    /api/contacts
GET/PUT/DEL /api/contacts/[id]

# Call Logs
GET/POST    /api/call-logs
GET/PUT     /api/call-logs/[id]

# Follow-Ups
GET/POST    /api/follow-ups
GET/PUT/DEL /api/follow-ups/[id]

# Opportunities
GET/POST    /api/opportunities
GET/PUT/DEL /api/opportunities/[id]
POST        /api/opportunities/[id]/convert-to-quote

# Service Tickets
GET/POST    /api/service-tickets
GET/PUT     /api/service-tickets/[id]
POST        /api/service-tickets/[id]/convert-to-work-order

# CRM Config (admin only)
GET/POST    /api/crm/call-types        + PUT/DEL /api/crm/call-types/[id]
GET/POST    /api/crm/call-outcomes      + PUT/DEL /api/crm/call-outcomes/[id]
GET/POST    /api/crm/follow-up-types    + PUT/DEL /api/crm/follow-up-types/[id]
GET/POST    /api/crm/lead-sources       + PUT/DEL /api/crm/lead-sources/[id]

# Sales Dashboard & Reports
GET         /api/crm/dashboard
GET         /api/crm/reports/call-activity
GET         /api/crm/reports/follow-up-performance
GET         /api/crm/reports/pipeline-summary
GET         /api/crm/reports/win-loss
GET         /api/crm/reports/customer-coverage
```

## Web Pages

```
# Sales route group: src/app/(sales)/
/sales/dashboard              — Stats + activity feed + pipeline
/sales/customers              — Customer list (tier/source columns added)
/sales/customers/[id]         — Customer detail (contacts + call history + opportunities)
/sales/calls                  — Call log list + filters
/sales/calls/new              — Call logging form
/sales/follow-ups             — Follow-up list (status/priority/due date)
/sales/opportunities          — Pipeline view (table with stage filters)
/sales/opportunities/[id]     — Opportunity detail
/sales/service-tickets        — Service ticket list
/sales/service-tickets/new    — Create service ticket
/sales/service-tickets/[id]   — Ticket detail (shows linked WO)
/sales/reports                — Sales reports with date/rep filters
/sales/settings               — CRM config (admin only)
```

ADMIN/DISPATCHER sidebar gets "Service Requests" link to view/convert tickets.

## Mobile (Role-based tabs in existing serviceops-mobile)

SALES role tab bar:
1. **Dashboard** — calls today, overdue follow-ups, pipeline snapshot
2. **Log Call** — quick call logging (customer → contact → outcome → notes)
3. **Follow-ups** — due today / overdue / upcoming sections
4. **Customers** — search + view details + contacts

## Deferred (v2)
- Microsoft Outlook Calendar sync (schema-ready with outlookEventId)
- Custom Fields system (per-industry attributes)
- Teams / hierarchical management structure
- SendGrid email dispatch for service tickets
