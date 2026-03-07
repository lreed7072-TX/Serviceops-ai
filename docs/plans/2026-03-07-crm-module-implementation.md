# CRM Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate a full CRM module into ServiceOps — contacts, call logs, follow-ups, opportunities, service tickets, sales reports, and SALES role with role-based mobile tabs.

**Architecture:** New Prisma models + enums added to existing schema. New `(sales)` route group for web pages. New API routes under `/api/contacts`, `/api/call-logs`, `/api/follow-ups`, `/api/opportunities`, `/api/service-tickets`, `/api/crm/`. SALES role added to Role enum. Mobile app gets role-based tab routing.

**Tech Stack:** Next.js 16.1, React 19, TypeScript 5, Prisma 6.16, Supabase, Custom CSS (not Tailwind)

**Design doc:** `docs/plans/2026-03-07-crm-module-design.md`

---

## Phase 1: Schema & Foundation

### Task 1: Add CRM enums to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (after existing enums, around line 17)

**Step 1: Add enums after the existing Role enum**

Add these enums to `prisma/schema.prisma` after the existing enums (after line ~196, before `model Org`):

```prisma
// CRM Enums
enum ContactMethod {
  PHONE
  EMAIL
  TEXT
}

enum ContactStatus {
  ACTIVE
  INACTIVE
}

enum CallMethod {
  PHONE
  IN_PERSON
  VIDEO_CALL
  EMAIL
}

enum FollowUpPriority {
  HOT
  NORMAL
  LOW
}

enum FollowUpStatus {
  PENDING
  COMPLETED
}

enum OpportunityStatus {
  PROSPECTING
  QUALIFICATION
  PROPOSAL
  NEGOTIATION
  WON
  LOST
}

enum TicketUrgency {
  LOW
  NORMAL
  HIGH
  EMERGENCY
}

enum TicketStatus {
  OPEN
  ASSIGNED
  CONVERTED
  CLOSED
}

enum CustomerTier {
  A
  B
  C
}
```

**Step 2: Add SALES to Role enum**

Change:
```prisma
enum Role {
  ADMIN
  DISPATCHER
  TECH
}
```
To:
```prisma
enum Role {
  ADMIN
  DISPATCHER
  TECH
  SALES
}
```

**Step 3: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(crm): add CRM enums and SALES role to schema"
```

---

### Task 2: Add CRM config models to schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add config models**

Add after the CRM enums block:

```prisma
// CRM Config Tables

model LeadSource {
  id           String   @id @default(uuid()) @db.Uuid
  orgId        String   @db.Uuid
  name         String
  displayOrder Int      @default(0)
  isActive     Boolean  @default(true)
  isDefault    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  org       Org        @relation(fields: [orgId], references: [id])
  customers Customer[]

  @@index([orgId])
}

model CallType {
  id           String   @id @default(uuid()) @db.Uuid
  orgId        String   @db.Uuid
  name         String
  displayOrder Int      @default(0)
  isActive     Boolean  @default(true)
  isDefault    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  org      Org       @relation(fields: [orgId], references: [id])
  callLogs CallLog[]

  @@index([orgId])
}

model CallOutcome {
  id                        String   @id @default(uuid()) @db.Uuid
  orgId                     String   @db.Uuid
  name                      String
  triggersFollowUp          Boolean  @default(false)
  triggersOpportunityPrompt Boolean  @default(false)
  displayOrder              Int      @default(0)
  isActive                  Boolean  @default(true)
  isDefault                 Boolean  @default(false)
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  org      Org       @relation(fields: [orgId], references: [id])
  callLogs CallLog[]

  @@index([orgId])
}

model FollowUpType {
  id           String   @id @default(uuid()) @db.Uuid
  orgId        String   @db.Uuid
  name         String
  displayOrder Int      @default(0)
  isActive     Boolean  @default(true)
  isDefault    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  org Org @relation(fields: [orgId], references: [id])

  @@index([orgId])
}
```

**Step 2: Add relation fields to Org model**

Find the `model Org` block and add these relation fields:

```prisma
  leadSources    LeadSource[]
  callTypes      CallType[]
  callOutcomes   CallOutcome[]
  followUpTypes  FollowUpType[]
```

**Step 3: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(crm): add CRM config models (CallType, CallOutcome, LeadSource, FollowUpType)"
```

---

### Task 3: Add Contact model to schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Contact model**

```prisma
model Contact {
  id                     String         @id @default(uuid()) @db.Uuid
  orgId                  String         @db.Uuid
  customerId             String         @db.Uuid
  firstName              String
  lastName               String
  title                  String?
  email                  String?
  phone                  String?
  mobilePhone            String?
  preferredContactMethod ContactMethod?
  isDecisionMaker        Boolean        @default(false)
  isTechnicalInfluencer  Boolean        @default(false)
  isGatekeeper           Boolean        @default(false)
  isPrimary              Boolean        @default(false)
  notes                  String?
  status                 ContactStatus  @default(ACTIVE)
  createdByUserId        String?        @db.Uuid
  createdAt              DateTime       @default(now())
  updatedAt              DateTime       @updatedAt

  org         Org           @relation(fields: [orgId], references: [id])
  customer    Customer      @relation(fields: [customerId], references: [id])
  createdBy   User?         @relation("ContactCreatedBy", fields: [createdByUserId], references: [id])
  callLogs    CallLog[]
  followUps   FollowUp[]
  opportunities Opportunity[]
  serviceTickets ServiceTicket[]

  @@index([orgId])
  @@index([customerId])
  @@index([orgId, customerId])
}
```

**Step 2: Add relation to Customer model**

Add to Customer model:
```prisma
  contacts     Contact[]
```

**Step 3: Add relation to Org model**

Add to Org model:
```prisma
  contacts     Contact[]
```

**Step 4: Add named relation to User model**

Add to User model:
```prisma
  createdContacts Contact[] @relation("ContactCreatedBy")
```

**Step 5: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(crm): add Contact model with customer/user relations"
```

---

### Task 4: Add CallLog and FollowUp models to schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add CallLog model**

```prisma
model CallLog {
  id                String     @id @default(uuid()) @db.Uuid
  orgId             String     @db.Uuid
  userId            String     @db.Uuid
  customerId        String     @db.Uuid
  siteId            String?    @db.Uuid
  contactId         String?    @db.Uuid
  callTypeId        String     @db.Uuid
  callOutcomeId     String     @db.Uuid
  callMethod        CallMethod
  callDuration      Int?
  competitorMentioned String?
  notes             String?
  callTimestamp     DateTime
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  org         Org         @relation(fields: [orgId], references: [id])
  user        User        @relation("CallLogUser", fields: [userId], references: [id])
  customer    Customer    @relation(fields: [customerId], references: [id])
  site        Site?       @relation(fields: [siteId], references: [id])
  contact     Contact?    @relation(fields: [contactId], references: [id])
  callType    CallType    @relation(fields: [callTypeId], references: [id])
  callOutcome CallOutcome @relation(fields: [callOutcomeId], references: [id])
  followUps   FollowUp[]
  opportunities Opportunity[]

  @@index([orgId])
  @@index([orgId, userId])
  @@index([orgId, customerId])
}
```

**Step 2: Add FollowUp model**

```prisma
model FollowUp {
  id               String           @id @default(uuid()) @db.Uuid
  orgId            String           @db.Uuid
  callLogId        String?          @db.Uuid
  customerId       String           @db.Uuid
  siteId           String?          @db.Uuid
  contactId        String?          @db.Uuid
  assignedToUserId String           @db.Uuid
  createdByUserId  String           @db.Uuid
  title            String
  description      String?
  dueDate          DateTime
  priority         FollowUpPriority @default(NORMAL)
  status           FollowUpStatus   @default(PENDING)
  completedAt      DateTime?
  reminderSent     Boolean          @default(false)
  outlookEventId   String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  org        Org      @relation(fields: [orgId], references: [id])
  callLog    CallLog? @relation(fields: [callLogId], references: [id])
  customer   Customer @relation(fields: [customerId], references: [id])
  site       Site?    @relation(fields: [siteId], references: [id])
  contact    Contact? @relation(fields: [contactId], references: [id])
  assignedTo User     @relation("FollowUpAssignedTo", fields: [assignedToUserId], references: [id])
  createdBy  User     @relation("FollowUpCreatedBy", fields: [createdByUserId], references: [id])

  @@index([orgId])
  @@index([orgId, assignedToUserId])
  @@index([orgId, dueDate])
  @@index([orgId, status])
}
```

**Step 3: Add all relation fields**

Add to **Org**: `callLogs CallLog[]`, `followUps FollowUp[]`
Add to **Customer**: `callLogs CallLog[]`, `followUps FollowUp[]`
Add to **Site**: `callLogs CallLog[]`, `followUps FollowUp[]`
Add to **User**: `callLogs CallLog[] @relation("CallLogUser")`, `assignedFollowUps FollowUp[] @relation("FollowUpAssignedTo")`, `createdFollowUps FollowUp[] @relation("FollowUpCreatedBy")`

**Step 4: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(crm): add CallLog and FollowUp models"
```

---

### Task 5: Add Opportunity and ServiceTicket models to schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Opportunity model**

```prisma
model Opportunity {
  id                String            @id @default(uuid()) @db.Uuid
  orgId             String            @db.Uuid
  callLogId         String?           @db.Uuid
  customerId        String            @db.Uuid
  siteId            String?           @db.Uuid
  contactId         String?           @db.Uuid
  createdByUserId   String            @db.Uuid
  name              String
  description       String?
  amount            Decimal?          @db.Decimal(12, 2)
  status            OpportunityStatus @default(PROSPECTING)
  expectedCloseDate DateTime?
  wonLostAt         DateTime?
  wonLostReason     String?
  convertedQuoteId  String?           @db.Uuid
  notes             String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  org           Org       @relation(fields: [orgId], references: [id])
  callLog       CallLog?  @relation(fields: [callLogId], references: [id])
  customer      Customer  @relation(fields: [customerId], references: [id])
  site          Site?     @relation(fields: [siteId], references: [id])
  contact       Contact?  @relation(fields: [contactId], references: [id])
  createdBy     User      @relation("OpportunityCreatedBy", fields: [createdByUserId], references: [id])
  convertedQuote Quote?   @relation("OpportunityQuote", fields: [convertedQuoteId], references: [id])

  @@index([orgId])
  @@index([orgId, status])
  @@index([orgId, createdByUserId])
}
```

**Step 2: Add ServiceTicket model**

```prisma
model ServiceTicket {
  id                    String        @id @default(uuid()) @db.Uuid
  orgId                 String        @db.Uuid
  createdByUserId       String        @db.Uuid
  customerId            String        @db.Uuid
  siteId                String?       @db.Uuid
  contactId             String?       @db.Uuid
  contactName           String?
  contactPhone          String?
  reasonForService      String
  serviceRequestedDate  DateTime?
  urgency               TicketUrgency @default(NORMAL)
  notes                 String?
  siteAddress           String?
  convertedWorkOrderId  String?       @db.Uuid
  status                TicketStatus  @default(OPEN)
  completedAt           DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  org              Org        @relation(fields: [orgId], references: [id])
  createdBy        User       @relation("ServiceTicketCreatedBy", fields: [createdByUserId], references: [id])
  customer         Customer   @relation(fields: [customerId], references: [id])
  site             Site?      @relation(fields: [siteId], references: [id])
  contact          Contact?   @relation(fields: [contactId], references: [id])
  convertedWorkOrder WorkOrder? @relation("TicketWorkOrder", fields: [convertedWorkOrderId], references: [id])

  @@index([orgId])
  @@index([orgId, status])
  @@index([orgId, createdByUserId])
}
```

**Step 3: Add relation fields to all referenced models**

Add to **Org**: `opportunities Opportunity[]`, `serviceTickets ServiceTicket[]`
Add to **Customer**: `opportunities Opportunity[]`, `serviceTickets ServiceTicket[]`
Add to **Site**: `opportunities Opportunity[]`, `serviceTickets ServiceTicket[]`
Add to **User**: `createdOpportunities Opportunity[] @relation("OpportunityCreatedBy")`, `createdServiceTickets ServiceTicket[] @relation("ServiceTicketCreatedBy")`
Add to **Quote**: `opportunityConversion Opportunity? @relation("OpportunityQuote")`
Add to **WorkOrder**: `serviceTicketSource ServiceTicket? @relation("TicketWorkOrder")`

**Step 4: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(crm): add Opportunity and ServiceTicket models"
```

---

### Task 6: Extend Customer model with CRM fields

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add new fields to Customer model**

Add these fields to the Customer model (after `qboCustomerId`):

```prisma
  // CRM fields
  tier              CustomerTier?
  leadSourceId      String?        @db.Uuid
  assignedToUserId  String?        @db.Uuid
  createdByUserId   String?        @db.Uuid
```

Add these relations (inside the Customer model relations block):

```prisma
  leadSource        LeadSource?    @relation(fields: [leadSourceId], references: [id])
  assignedTo        User?          @relation("CustomerAssignedTo", fields: [assignedToUserId], references: [id])
  createdBy         User?          @relation("CustomerCreatedBy", fields: [createdByUserId], references: [id])
```

Add to **User** model:
```prisma
  assignedCustomers Customer[] @relation("CustomerAssignedTo")
  createdCustomers  Customer[] @relation("CustomerCreatedBy")
```

**Step 2: Run prisma db push**

```bash
npx prisma db push
```

This applies ALL schema changes from Tasks 1-6 to the database.

**Step 3: Run prisma generate**

```bash
npx prisma generate
```

**Step 4: Build to verify no type errors**

```bash
npx next build
```

**Step 5: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(crm): extend Customer with tier/leadSource/assignedTo, push schema to DB"
```

---

## Phase 2: CRM API Routes

### Task 7: Contacts API (CRUD)

**Files:**
- Create: `src/app/api/contacts/route.ts`
- Create: `src/app/api/contacts/[id]/route.ts`

Follow the exact pattern from `src/app/api/customers/route.ts`:
- `requireAuthSessionFirst(request)` on every handler
- `orgId: auth.orgId` on every query
- SALES role: can CRUD contacts for any customer in their org
- TECH role: no access (return 403)
- Pagination: `limit`/`offset`/`total` pattern
- Search: `firstName`, `lastName`, `email` with `contains` + `mode: "insensitive"`
- Filter: `customerId` query param
- GET list includes `customer` relation (name only)
- POST requires `customerId`, `firstName`, `lastName`
- GET/PUT/DELETE `[id]` with org-scoped lookup

**Commit:** `feat(crm): add Contacts API endpoints`

---

### Task 8: Call Logs API (CRUD)

**Files:**
- Create: `src/app/api/call-logs/route.ts`
- Create: `src/app/api/call-logs/[id]/route.ts`

- SALES + ADMIN can create/edit. DISPATCHER read-only. TECH no access.
- GET list: filter by `userId`, `customerId`, `callTypeId`, `callOutcomeId`. Pagination. Include `customer.name`, `contact.firstName`/`lastName`, `callType.name`, `callOutcome.name`, `callOutcome.triggersFollowUp`, `callOutcome.triggersOpportunityPrompt`.
- POST: requires `customerId`, `callTypeId`, `callOutcomeId`, `callMethod`, `callTimestamp`. Sets `userId: auth.userId`.
- Response includes the outcome trigger flags so the frontend can prompt for follow-up/opportunity creation.

**Commit:** `feat(crm): add Call Logs API endpoints`

---

### Task 9: Follow-Ups API (CRUD)

**Files:**
- Create: `src/app/api/follow-ups/route.ts`
- Create: `src/app/api/follow-ups/[id]/route.ts`

- SALES + ADMIN can CRUD. DISPATCHER read-only. TECH no access.
- GET list: filter by `assignedToUserId`, `status`, `priority`. Sort by `dueDate asc`. Include `customer.name`, `contact`, `assignedTo.name`.
- ADMIN sees all follow-ups. SALES sees only `assignedToUserId: auth.userId`.
- POST: requires `customerId`, `assignedToUserId`, `title`, `dueDate`. Sets `createdByUserId: auth.userId`.
- PATCH: allow updating `status` to COMPLETED (sets `completedAt`).

**Commit:** `feat(crm): add Follow-Ups API endpoints`

---

### Task 10: Opportunities API (CRUD + convert)

**Files:**
- Create: `src/app/api/opportunities/route.ts`
- Create: `src/app/api/opportunities/[id]/route.ts`
- Create: `src/app/api/opportunities/[id]/convert-to-quote/route.ts`

- SALES + ADMIN can CRUD. DISPATCHER read-only. TECH no access.
- GET list: filter by `status`, `customerId`, `createdByUserId`. Include `customer.name`, `contact`, `convertedQuote`. Pagination.
- ADMIN sees all. SALES sees own (`createdByUserId: auth.userId`).
- POST: requires `customerId`, `name`. Sets `createdByUserId: auth.userId`.
- Convert endpoint: POST creates a new Quote from opportunity data (customer, site, description, amount as line item), sets `convertedQuoteId` on opportunity, returns the new quote ID.

**Commit:** `feat(crm): add Opportunities API with convert-to-quote`

---

### Task 11: Service Tickets API (CRUD + convert)

**Files:**
- Create: `src/app/api/service-tickets/route.ts`
- Create: `src/app/api/service-tickets/[id]/route.ts`
- Create: `src/app/api/service-tickets/[id]/convert-to-work-order/route.ts`

- SALES can create + view. ADMIN + DISPATCHER can view + convert. TECH no access.
- GET list: filter by `status`, `urgency`, `createdByUserId`. Include `customer.name`, `contact`, `createdBy.name`, `convertedWorkOrder`. Pagination.
- POST: requires `customerId`, `reasonForService`. Sets `createdByUserId`, snapshots `contactName`/`contactPhone` if contactId provided.
- Convert endpoint: POST creates a WorkOrder from ticket (customer, site, title=reasonForService, description=notes), sets `convertedWorkOrderId`, updates status to CONVERTED. Creates notification for the salesperson who created the ticket.

**Commit:** `feat(crm): add Service Tickets API with convert-to-work-order`

---

### Task 12: CRM Config APIs (call types, outcomes, lead sources, follow-up types)

**Files:**
- Create: `src/app/api/crm/call-types/route.ts`
- Create: `src/app/api/crm/call-types/[id]/route.ts`
- Create: `src/app/api/crm/call-outcomes/route.ts`
- Create: `src/app/api/crm/call-outcomes/[id]/route.ts`
- Create: `src/app/api/crm/follow-up-types/route.ts`
- Create: `src/app/api/crm/follow-up-types/[id]/route.ts`
- Create: `src/app/api/crm/lead-sources/route.ts`
- Create: `src/app/api/crm/lead-sources/[id]/route.ts`

All follow identical pattern:
- ADMIN only for create/update/delete. All authenticated roles can GET list.
- GET returns all for org, ordered by `displayOrder asc`.
- POST/PUT: name, displayOrder, isActive, isDefault. CallOutcome also has `triggersFollowUp`, `triggersOpportunityPrompt`.
- DELETE: hard delete (these are config items).

**Commit:** `feat(crm): add CRM config APIs (call types, outcomes, lead sources, follow-up types)`

---

### Task 13: CRM Dashboard and Reports APIs

**Files:**
- Create: `src/app/api/crm/dashboard/route.ts`
- Create: `src/app/api/crm/reports/call-activity/route.ts`
- Create: `src/app/api/crm/reports/follow-up-performance/route.ts`
- Create: `src/app/api/crm/reports/pipeline-summary/route.ts`
- Create: `src/app/api/crm/reports/win-loss/route.ts`
- Create: `src/app/api/crm/reports/customer-coverage/route.ts`

**Dashboard:** Returns aggregated stats:
- `callsThisWeek`, `callsThisMonth` (count where callTimestamp in range)
- `openFollowUps`, `overdueFollowUps` (count where status=PENDING, dueDate < now)
- `pipelineValue` (sum amount where status not in WON/LOST)
- `openOpportunities` (count)
- `openServiceTickets` (count where status=OPEN)

ADMIN sees all. SALES sees own data only.

**Reports:** Each accepts `startDate`, `endDate`, `userId` (admin can filter by rep) query params. Uses Prisma `groupBy` for aggregation. Returns data shaped for Recharts.

**Commit:** `feat(crm): add CRM dashboard and sales reports APIs`

---

## Phase 3: Sales Web Pages

### Task 14: Sales layout and sidebar

**Files:**
- Create: `src/app/(sales)/layout.tsx`
- Create: `src/app/(sales)/sales.css`

- Reuse the same shell pattern as `src/app/(app)/layout.tsx` — SidebarNav with different links
- Sidebar links: Dashboard, Customers, Call Log, Follow-ups, Opportunities, Service Tickets, Reports, Settings (admin only)
- Use same CSS variable system, same SidebarNav component (it accepts a `links` prop)
- Auth check: require SALES or ADMIN role. Redirect others to their appropriate route group.

**Commit:** `feat(crm): add sales route group layout with sidebar`

---

### Task 15: Sales Dashboard page

**Files:**
- Create: `src/app/(sales)/sales/dashboard/page.tsx`

- Fetch `/api/crm/dashboard`
- Stat cards: Calls This Week, Open Follow-ups (highlight overdue), Pipeline Value, Open Tickets
- Recent activity section: last 10 call logs with customer name + outcome
- Pipeline mini-summary: opportunity count by stage

**Commit:** `feat(crm): add sales dashboard page`

---

### Task 16: Contacts management (within customer detail)

**Files:**
- Create: `src/app/(sales)/sales/customers/page.tsx` (list — can extend/mirror existing customers page with CRM columns: tier, assigned rep, lead source)
- Create: `src/app/(sales)/sales/customers/[id]/page.tsx` (detail with contacts tab, call history, opportunities, service tickets)

Customer detail page tabs/sections:
1. **Info** — name, tier, lead source, assigned rep, billing address, notes
2. **Contacts** — list of contacts with add/edit modal. Shows role badges (Decision Maker, Gatekeeper, Technical).
3. **Call History** — recent calls with type, outcome, notes, duration
4. **Opportunities** — linked opportunities with status badges
5. **Service Tickets** — linked tickets with status
6. **Activity** — reuse existing `/api/customers/[id]/activity` pattern + add CRM activities

**Commit:** `feat(crm): add sales customer list and detail pages with contacts`

---

### Task 17: Call Log pages

**Files:**
- Create: `src/app/(sales)/sales/calls/page.tsx` (list with filters)
- Create: `src/app/(sales)/sales/calls/new/page.tsx` (call logging form)

**Call logging form flow:**
1. Select Customer (searchable dropdown)
2. Select Contact (filtered by customer, optional)
3. Select Call Type + Call Method
4. Select Outcome
5. Duration (hours/minutes inputs)
6. Competitor mentioned (text)
7. Notes (textarea)
8. Submit → if outcome triggers follow-up, show follow-up creation modal pre-filled
9. If outcome triggers opportunity prompt, show opportunity creation modal pre-filled

**Call list:** Table with customer, contact, type, outcome, method, duration, timestamp. Filter by date range, customer. Pagination.

**Commit:** `feat(crm): add call log list and call logging form`

---

### Task 18: Follow-Ups page

**Files:**
- Create: `src/app/(sales)/sales/follow-ups/page.tsx`

- List with status tabs (All, Pending, Completed)
- Priority badges (Hot = red, Normal = blue, Low = gray)
- Overdue items highlighted
- Create modal: customer, contact, title, description, due date, priority
- Complete action: marks as completed with timestamp
- Filter by priority, date range

**Commit:** `feat(crm): add follow-ups page`

---

### Task 19: Opportunities page

**Files:**
- Create: `src/app/(sales)/sales/opportunities/page.tsx`
- Create: `src/app/(sales)/sales/opportunities/[id]/page.tsx`

**List page:** Table with stage filter tabs (All, Prospecting, Qualification, Proposal, Negotiation, Won, Lost). Shows name, customer, amount, expected close date, stage badge.

**Detail page:**
- Header with name, customer, amount, stage badge
- Stage progression indicator
- "Convert to Quote" button (when stage = PROPOSAL or later, and no convertedQuoteId)
- Won/Lost actions with reason capture
- Linked call log, contact info
- Edit modal for all fields

**Commit:** `feat(crm): add opportunities list and detail pages`

---

### Task 20: Service Tickets page

**Files:**
- Create: `src/app/(sales)/sales/service-tickets/page.tsx`
- Create: `src/app/(sales)/sales/service-tickets/new/page.tsx`
- Create: `src/app/(sales)/sales/service-tickets/[id]/page.tsx`

**List:** Status tabs (Open, Assigned, Converted, Closed). Urgency badges. Customer name, reason, requested date.

**Create form:** Customer (dropdown), Site (filtered), Contact (filtered), reason for service, urgency, requested date, notes, site address.

**Detail:** Shows all info. If converted, links to Work Order. ADMIN/DISPATCHER see "Convert to Work Order" button.

Also add a "Service Requests" link to the ADMIN/DISPATCHER sidebar in `src/app/(app)/layout.tsx` that links to a view of open service tickets.

**Commit:** `feat(crm): add service tickets pages`

---

### Task 21: Sales Reports page

**Files:**
- Create: `src/app/(sales)/sales/reports/page.tsx`

- Date range picker (default: this month)
- Salesperson filter (ADMIN sees all reps dropdown, SALES sees own only)
- Report sections with Recharts visualizations:
  1. **Call Activity** — bar chart: calls by day. Table: calls by type, by outcome.
  2. **Follow-up Performance** — stats: open/overdue/completed/avg completion time. Bar chart by rep.
  3. **Pipeline Summary** — horizontal bar chart: value by stage. Stats: total pipeline value, avg deal size, count.
  4. **Win/Loss** — pie chart: win rate. Table: loss reasons.
  5. **Customer Coverage** — stats: customers contacted vs total, contact frequency.

**Commit:** `feat(crm): add sales reports page with Recharts`

---

### Task 22: CRM Settings page

**Files:**
- Create: `src/app/(sales)/sales/settings/page.tsx`

- ADMIN only (redirect SALES role away)
- Sections with reorderable lists for: Call Types, Call Outcomes, Follow-Up Types, Lead Sources
- Each section: list with name, active toggle, default toggle
- Call Outcomes: additional toggles for `triggersFollowUp` and `triggersOpportunityPrompt`
- Add/Edit modal for each config type
- Delete with confirmation

**Commit:** `feat(crm): add CRM settings page for config management`

---

## Phase 4: Mobile Integration

### Task 23: Role-based tab routing in mobile app

**Files:**
- Modify: `serviceops-mobile/src/app/(tabs)/_layout.tsx`

- Check user role from auth store
- TECH role: existing tabs (Work Orders, Tasks, Timer, Profile)
- SALES role: new tabs (Dashboard, Log Call, Follow-ups, Customers)
- ADMIN role: can switch between views (or show combined)

**Commit:** `feat(crm): role-based mobile tab routing`

---

### Task 24: Mobile sales screens

**Files:**
- Create: `serviceops-mobile/src/app/(tabs)/sales-dashboard.tsx`
- Create: `serviceops-mobile/src/app/(tabs)/log-call.tsx`
- Create: `serviceops-mobile/src/app/(tabs)/follow-ups.tsx`
- Create: `serviceops-mobile/src/app/(tabs)/sales-customers.tsx`

**Sales Dashboard:** Stat cards (calls today, overdue follow-ups, pipeline value). Quick action buttons.

**Log Call:** Step-by-step form optimized for one-handed use. Customer search → Contact select → Type → Outcome → Notes → Submit. Auto-prompt for follow-up/opportunity based on outcome triggers.

**Follow-ups:** Sections: Overdue (red), Due Today (orange), Upcoming. Tap to complete. Swipe actions.

**Sales Customers:** Search + list. Tap for detail with contacts, recent calls.

**Commit:** `feat(crm): add mobile sales screens (dashboard, call log, follow-ups, customers)`

---

## Phase 5: Integration & Polish

### Task 25: Notification integration

**Files:**
- Modify: `src/components/notifications/NotificationBell.tsx` (add new notification type icons)
- Modify service ticket convert endpoint to create notifications

Add notification creation when:
- Service ticket created → notify ADMIN + DISPATCHER
- Service ticket converted to WO → notify ticket creator (salesperson)
- Follow-up overdue → notify assigned user (could be cron or checked on dashboard load)
- Opportunity won/lost → notify ADMIN

**Commit:** `feat(crm): integrate CRM events with notification system`

---

### Task 26: Update auth helpers for SALES role

**Files:**
- Modify: `src/lib/auth.ts` — ensure `requireRole` helper works with SALES
- Modify: existing API routes that use `requireRole(auth, [Role.ADMIN, Role.DISPATCHER])` — add SALES where appropriate (customers GET, quotes GET, work-orders GET read-only)

The SALES role should have read-only access to:
- `/api/quotes` (GET only)
- `/api/work-orders` (GET only)
- `/api/invoices` (GET only)

**Commit:** `feat(crm): update auth for SALES role read-only access`

---

### Task 27: Build verification and push

**Step 1:** Run full build
```bash
npx next build
```

**Step 2:** Run tests
```bash
npm test
```

**Step 3:** Fix any issues

**Step 4:** Push to deploy
```bash
git push origin main
```

**Commit:** `chore: verify build clean after CRM module integration`

---

## Execution Notes

- **Total new files:** ~50+ (API routes, pages, CSS)
- **Total modified files:** ~10 (schema, auth, existing layouts, notification bell)
- **New Prisma models:** 9 (Contact, CallLog, FollowUp, Opportunity, ServiceTicket, CallType, CallOutcome, FollowUpType, LeadSource)
- **New enums:** 10
- **New API routes:** ~30 endpoints
- **New web pages:** ~12
- **New mobile screens:** 4

- **CSS approach:** Custom CSS files per page (same pattern as existing pages). Use existing CSS variables from `globals.css`.
- **No Tailwind.** Custom CSS with `var(--accent)`, `var(--primary)`, etc.
- **All API routes:** Must use `requireAuthSessionFirst`, `orgId` scoping, `jsonError` pattern.
- **Pagination:** `limit`/`offset`/`total` on all list endpoints.
