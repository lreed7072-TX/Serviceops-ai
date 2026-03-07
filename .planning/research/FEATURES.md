# Features Research: QBO Integration for Service Management SaaS

**Date**: 2026-03-07
**Author**: Research pass for ServiceOpsIQ QBO Full Integration milestone
**Scope**: Expanding from 4 existing integration points to 19+ across the full service-to-cash lifecycle

---

## Context: What Already Exists

ServiceOpsIQ has these QBO touchpoints live:
- OAuth 2.0 connect/disconnect
- Customer outbound sync (ServiceOps → QBO)
- Invoice outbound push (ServiceOps → QBO)
- Basic payment webhook listener (logs only, no processing)

Everything below is net-new.

---

## Table Stakes

These are features that buyers at any serious price point ($5K–$50K+/yr) expect. If missing, they
either won't buy or will churn to a competitor. Verified against Jobber, Housecall Pro, and
FieldPulse — all three mid-market tools have these.

---

### TS-01: Payment Receipt Processing

**What it is**: When a payment is recorded in QBO (manually or via QBO Payments), the webhook
fires and ServiceOpsIQ marks the invoice PAID, records the payment amount, date, and method.

**Why table stakes**: The invoice push (existing) is useless without the return loop. Accountants
pay bills in QBO; without this, ops staff see invoices stuck as "unpaid" indefinitely. This is the
#1 complaint in FSM + QBO integration reviews across all competitors.

**QBO entities**: `Payment` (via webhook event `Payment.Create` / `Payment.Update`)

**Complexity**: Low. The webhook infrastructure already exists. This is completing the handler that
currently only logs.

**Dependencies**: Existing webhook listener, invoice outbound push (existing).

---

### TS-02: Invoice Status Bidirectional Sync

**What it is**: Invoice voids, partial payments, credit memos applied, and balance changes that
happen in QBO are reflected back in ServiceOpsIQ. Conversely, when ServiceOpsIQ marks an invoice
void or cancelled, it voids the QBO Invoice via API.

**Why table stakes**: Without this, the two systems diverge immediately after the first manual
accounting adjustment. Every QBO user manually adjusts invoices; this is not optional.

**QBO entities**: `Invoice` (CRUD via REST), `Invoice.Void` operation, `Payment` linking

**Complexity**: Medium. Requires CDC polling or webhook handling for inbound, plus SyncToken
management for outbound updates.

**Dependencies**: TS-01 (payment processing), TS-07 (CDC inbound sync).

---

### TS-03: Item / Service Sync (Pricebook ↔ QBO Items)

**What it is**: Materials and labor rate line items in ServiceOpsIQ map to QBO Items (Products &
Services). New items created in ServiceOpsIQ push to QBO. Items imported from QBO on initial
setup. Each item carries its income account assignment, enabling proper GL posting.

**Why table stakes**: Without item sync, every invoice pushed to QBO has unrecognized line items
or falls back to a single "Services" account, which breaks any job-costing or P&L-by-category
reporting. Jobber, FieldPulse, and Housecall Pro all sync items as a core feature. ServiceTitan
requires item mapping as a prerequisite before any invoice can export — it blocks export on
unmapped items.

**QBO entities**: `Item` (type: Service, NonInventory, Inventory)

**Complexity**: Medium. Bidirectional mapping table required (ServiceOps itemId ↔ QBO itemId).
Income account must be selected per item; requires Chart of Accounts pull first (see TS-05).

**Dependencies**: TS-05 (Chart of Accounts pull).

---

### TS-04: Estimate / Quote Sync

**What it is**: When a quote is created or approved in ServiceOpsIQ, it syncs to QBO as an
Estimate. When the estimate is accepted in QBO, the status reflects back. When an invoice is
generated from the quote, QBO converts its Estimate to an Invoice automatically via API.

**Why table stakes**: The quote-to-invoice workflow is the core financial lifecycle in every FSM
tool. Disconnecting it creates double-entry. All four benchmarked competitors (ServiceTitan,
Jobber, Housecall Pro, FieldPulse) sync estimates.

**QBO entities**: `Estimate` (CRUD), `Invoice` created from `Estimate` via `LinkedTxn`

**Complexity**: Medium. QBO Estimate → Invoice conversion via LinkedTxn reference is
straightforward but requires careful status mapping (PENDING, ACCEPTED, INVOICED, REJECTED).

**Dependencies**: TS-03 (items must be mapped for line items to resolve).

---

### TS-05: Chart of Accounts Pull

**What it is**: ServiceOpsIQ pulls the org's QBO Chart of Accounts on demand and on connection.
Accounts are stored locally and surfaced in mapping UIs (for items, expenses, time, classes).

**Why table stakes**: Every other integration point requires account mapping. Without this, admins
cannot assign income/expense accounts to line items, which breaks proper bookkeeping. ServiceTitan
makes COA mapping a hard prerequisite — no exports allowed until mapping is complete.

**QBO entities**: `Account` (read-only query)

**Complexity**: Low. Single read query, cache locally with a manual refresh option.

**Dependencies**: None. This is the foundational prerequisite for most other features.

---

### TS-06: Integration Health Dashboard

**What it is**: A dedicated UI in the QBO settings section showing: connection status, last sync
timestamps per entity type, sync error log with error descriptions and resolution hints, manual
re-trigger buttons per entity type, and a count of pending/failed/successful sync operations.

**Why table stakes**: Every competitor has this. Jobber's sync activity dashboard with inline error
resolution is specifically praised in reviews. Without a health dashboard, support tickets explode
— admins have no visibility into why data is missing in QBO.

**QBO entities**: None directly. Reads from `QboSyncLog` (already in Prisma schema).

**Complexity**: Low. The `QboSyncLog` model already exists. This is a UI build on top of existing
data, plus surfacing errors with actionable messages.

**Dependencies**: All other sync features (to have meaningful data to display).

---

### TS-07: Change Data Capture (CDC) Inbound Sync

**What it is**: A scheduled job (cron or on-demand trigger) calls the QBO CDC endpoint with the
last-synced timestamp. QBO returns all entities changed since that timestamp. ServiceOpsIQ
processes the deltas to update local records — specifically invoices (status, balance, void),
customers (name, contact), and items (price, account).

**Why table stakes**: Without inbound sync, ServiceOpsIQ is write-only to QBO. Any correction an
accountant makes in QBO (voiding an invoice, updating a customer address) is invisible. CDC is the
QBO-recommended pattern for this — it is a single API call that returns all entity changes,
drastically more efficient than polling individual entities.

**QBO entities**: CDC endpoint covering `Invoice`, `Customer`, `Item`, `Payment`, `Estimate`

**Complexity**: Medium. CDC response must be diffed against local records. Idempotency is critical
(webhooks and CDC can deliver the same event). Requires a stored `lastCdcSync` timestamp per org.

**Dependencies**: TS-02, TS-03, TS-04, TS-05. CDC is meaningless until there is something to sync
back.

---

## Differentiators

These features separate a $50K+ enterprise positioning from a $5K/yr SMB tool. None of the
mid-market competitors (Jobber, Housecall Pro, FieldPulse) fully implement these. ServiceTitan
partially does, but with friction. This is where ServiceOpsIQ can lead.

---

### D-01: Time Activity Sync (Technician Hours → QBO TimeActivity)

**What it is**: Technician time entries logged against work orders in ServiceOpsIQ sync to QBO as
`TimeActivity` records, associated with the correct employee and customer. This enables QBO to
generate labor cost reports, payroll prep exports, and job-level time analysis without any manual
re-entry.

**Why a differentiator**: Jobber syncs timesheets to QBO but does not map them to QBO
TimeActivity entities — they appear as line items on invoices only. FieldPulse added QBO Time sync
in early 2025 as a new feature. ServiceTitan syncs time but through a complex business-unit
mapping that requires accountant setup. ServiceOpsIQ can do this cleanly with direct TimeActivity
entities, supporting unapplied labor visibility (a KPI ServiceTitan markets heavily).

**QBO entities**: `TimeActivity` (employee-linked, customer-linked, billable flag)

**Complexity**: Medium. Requires employee sync (D-02) first. Time entries need billable/non-
billable classification. Hourly rate on TimeActivity must match QBO Employee or Item rate.

**Dependencies**: D-02 (employee sync), TS-03 (items for labor rate).

---

### D-02: Employee Sync (Techs → QBO Employees)

**What it is**: ServiceOpsIQ technicians sync to QBO as Employee records, with name, email, and
billable rate. This is a prerequisite for TimeActivity sync and for payroll journal entries.

**Why a differentiator**: Mid-market tools treat QBO as accounting-only and keep HR/team data
siloed. Linking field tech identities to QBO Employees enables true labor cost tracking per job.

**QBO entities**: `Employee` (CRUD)

**Complexity**: Low-Medium. Employees are relatively simple entities. Main complexity is the
mapping table (ServiceOps userId ↔ QBO employeeId) and handling deactivation.

**Dependencies**: None, but blocks D-01.

---

### D-03: Expense / Bill Sync (Job Expenses → QBO Bills / Purchases)

**What it is**: When materials are consumed on a job or a vendor receipt is recorded in
ServiceOpsIQ, it creates a corresponding `Bill` (if from a vendor with Net terms) or `Purchase`
(if paid immediately via credit card / cash) in QBO, linked to the correct vendor, GL account, and
job class.

**Why a differentiator**: This closes the accounts payable loop. Without it, the P&L in QBO shows
revenue from jobs but not the direct costs — making job profitability invisible. ServiceTitan
supports PO-to-bill export (new 2025 feature). Lexul markets this as "ERP-level functionality."
No mid-market tool does this reliably for field-consumed materials.

**QBO entities**: `Bill`, `BillPayment`, `Purchase`, `Vendor`

**Complexity**: High. Requires vendor sync (D-04), account mapping for expense categories, and
matching whether a vendor is AP (Net terms → Bill) or direct-pay (Purchase). Also must handle
partial receipts and multi-line bills.

**Dependencies**: D-04 (vendor sync), TS-05 (COA for expense accounts).

---

### D-04: Vendor Sync

**What it is**: Suppliers and subcontractors in ServiceOpsIQ sync to QBO as `Vendor` records.
New vendors created in either system are reconciled.

**Why a differentiator**: Required for expense/bill sync. Most mid-market FSM tools skip vendor
management entirely. At enterprise scale, multi-vendor procurement is routine.

**QBO entities**: `Vendor` (CRUD)

**Complexity**: Low-Medium. Similar to customer sync (existing). Main challenge is dedup matching
(same vendor with slightly different names in both systems).

**Dependencies**: None, but blocks D-03.

---

### D-05: Purchase Order Sync

**What it is**: Purchase orders created in ServiceOpsIQ for job materials sync to QBO. When the
vendor bill arrives, the accountant can match it against the existing PO in QBO for three-way
matching (PO → Receipt → Bill).

**Why a differentiator**: ServiceTitan added PO-to-bill export as a 2025 differentiator marketed
specifically for enterprise clients. Lexul markets this as its key ERP-level feature. No SMB tool
does this. Industrial service businesses (GPS's market) routinely procure parts per job.

**QBO entities**: `PurchaseOrder` (QBO Online Plus/Advanced required)

**Complexity**: High. `PurchaseOrder` entity is only available on QBO Online Plus and Advanced
tiers — must verify customer's QBO subscription at connect time and gracefully degrade if not
available. Lifecycle states (Open, Closed, Partially Received) must be tracked.

**Dependencies**: D-04 (vendor sync), TS-05 (COA for expense accounts). Note: PurchaseOrder
entity requires QBO Online Plus or higher — add a subscription tier check at connect time.

---

### D-06: Class Tracking on All Synced Transactions

**What it is**: QBO Classes (e.g., by division, service line, or region) are applied to every
synced transaction — invoices, bills, time activities, payments — using a mapping from ServiceOpsIQ
concepts (work order type, site, asset category) to QBO Class IDs.

**Why a differentiator**: Class tracking is a QBO Plus/Advanced feature that enables P&L by
division. ServiceTitan's business-unit-to-class mapping is marketed as a primary differentiator
for multi-division shops. No mid-market tool does this automatically. For GPS-type businesses with
multiple service lines (preventive maintenance, emergency repair, installation), class-level P&L
is a direct controller-level requirement.

**QBO entities**: `Class` (reference on `Invoice`, `Bill`, `TimeActivity`, `Payment`)

**Complexity**: Medium. Class list must be pulled and stored. Mapping UI needed (work order
type / service type → QBO Class). Must be applied at line-item level, not just header level, for
full QBO class tracking compatibility.

**Dependencies**: TS-05 (COA pull), TS-03 (items). Requires QBO Plus or Advanced.

---

### D-07: Location / Department Tracking

**What it is**: QBO Locations (a.k.a. Departments on some QBO plans) are applied to transactions,
enabling P&L by physical location or business unit.

**Why a differentiator**: Complement to Class tracking. Enables multi-site businesses (GPS has
multiple yards) to see financial performance per location without a separate accounting system.
ServiceTitan maps its business units to both Classes and Locations.

**QBO entities**: `Department` (reference on transactions; QBO Advanced required)

**Complexity**: Medium. Similar to D-06. QBO Advanced tier required — same subscription check
applies.

**Dependencies**: D-06 (same mapping infrastructure). Requires QBO Advanced.

---

### D-08: QBO Reports API Integration

**What it is**: ServiceOpsIQ pulls financial reports directly from QBO via the Reports API and
surfaces them inside the app: Profit & Loss (overall and by class/job), Accounts Receivable Aging,
Balance Sheet, and Revenue by Customer. These are embedded in the analytics dashboard alongside
ServiceOpsIQ's own operational metrics.

**Why a differentiator**: No mid-market FSM tool pulls QBO Reports API data back into the app.
Most tools push data out and tell the user to "log into QBO to see reports." Embedding QBO
financial data alongside ServiceOpsIQ job/tech/asset metrics creates a single command center that
a business owner or controller cannot get anywhere else at this price point. This is a genuine
enterprise differentiator and a strong demo moment.

**QBO entities**: Reports API (`ProfitAndLoss`, `AgedReceivableDetail`, `BalanceSheet`,
`CustomerIncome`)

**Complexity**: Medium. Reports API is read-only and has different URL structure from entity API.
Response is a table format requiring parsing. Caching is essential (expensive calls; cache 15–30
min). No write operations involved.

**Dependencies**: TS-05 (COA, so report data is meaningful). D-06 (Class) enables P&L by class.

---

### D-09: Recurring Invoice Templates for Maintenance Contracts

**What it is**: ServiceOpsIQ preventive maintenance contracts (recurring WO schedules) generate
corresponding QBO Recurring Invoice templates. On each PM interval, the invoice is auto-created in
both ServiceOpsIQ and QBO without manual intervention.

**Why a differentiator**: QuickBooks Online supports recurring transactions natively but has no
awareness of service schedules. FSM tools with PM scheduling can close this loop. For GPS-type
businesses on retainer maintenance contracts, this eliminates one of the most error-prone manual
processes (forgetting to bill for monthly PMs). No competitor below ServiceTitan's price tier does
this automatically.

**QBO entities**: `RecurringTransaction` (template type Invoice), triggered programmatically per
PM cron cycle

**Complexity**: High. RecurringTransaction management in QBO is complex. The cleaner
implementation may be to skip QBO's recurring template system and instead have the PM cron
(already existing in ServiceOpsIQ) create a standard QBO Invoice on each PM generation, which is
simpler and more controllable.

**Dependencies**: Existing PM cron (`/api/cron/generate-pms`), TS-04 (estimate/invoice sync).

---

### D-10: Customer Inbound Sync (QBO → ServiceOps)

**What it is**: Customers created or updated in QBO sync back into ServiceOpsIQ. During initial
setup, the admin can bulk-import their existing QBO customer list. Ongoing via CDC.

**Why a differentiator**: Jobber explicitly made their sync one-way (Jobber → QBO only) after
their 2023 integration rewrite, citing conflict complexity. FieldPulse does bidirectional customer
sync and markets it as an advantage. For businesses that manage customer records in QBO (common
among accountant-led operations), inbound customer sync prevents orphaned records and duplicate
creation.

**QBO entities**: `Customer` (CDC + bulk query for initial import)

**Complexity**: Medium. Conflict resolution strategy required (which system wins on field-level
conflicts). Recommended: ServiceOpsIQ wins on operational fields (site address, contact name);
QBO wins on billing fields (payment terms, tax code).

**Dependencies**: TS-07 (CDC for ongoing), TS-05 (COA for customer default payment terms).

---

### D-11: Credit Memo Creation

**What it is**: When a work order is cancelled after invoicing, or a dispute results in a partial
refund, ServiceOpsIQ creates a `CreditMemo` in QBO against the original invoice. The credit is
tracked in both systems.

**Why a differentiator**: Jobber and Housecall Pro do not expose credit memo creation via their
QBO integrations. It is a common accountant request. Handling this in-app prevents the awkward
workaround of voiding and re-issuing invoices.

**QBO entities**: `CreditMemo` (linked to original Invoice via `LinkedTxn`)

**Complexity**: Medium. Must link to original invoice. Partial vs. full credit. Requires
SyncToken for the original invoice.

**Dependencies**: TS-02 (invoice status sync), TS-01 (payment processing).

---

### D-12: Invoice Email via QBO API

**What it is**: ServiceOpsIQ can trigger QBO to send the invoice email to the customer directly
from QBO (using the customer's QBO billing email), so the invoice arrives from the business's QBO
account (with QBO branding / custom email domain if configured), rather than from ServiceOpsIQ.

**Why a differentiator**: Accountants strongly prefer invoice emails to originate from QBO so
replies and payment links route through QBO's payment portal. ServiceOpsIQ already sends its own
invoice emails; this adds a "Send via QBO" option for businesses that want payment processing
through QBO Payments.

**QBO entities**: `Invoice` send operation (`POST /v3/company/{realmId}/invoice/{id}/send`)

**Complexity**: Low. Single API call per invoice. Needs a UI toggle: "Send via ServiceOpsIQ" vs.
"Send via QBO."

**Dependencies**: Invoice outbound push (existing).

---

## Anti-Features

These are things to deliberately not build in v1, with rationale.

---

### AF-01: Bank Deposit Matching

**What it is**: Matching payments received in QBO's bank feed to open invoices.

**Why not**: QBO's banking module already handles this natively with ML-based matching rules. No
FSM tool attempts to compete here — it would require direct bank feed API access (Plaid or QBO
Banking API), which adds PCI/compliance surface area. The ServiceOpsIQ payment loop (invoice →
payment webhook → mark PAID) is sufficient. Users who need deposit matching do it in QBO where
it already works well.

**Cost**: High complexity (bank feed integration, reconciliation logic, compliance).
**Benefit**: Near zero — QBO already solves it.

---

### AF-02: Multi-Currency Support

**What it is**: Syncing invoices, payments, and bills in currencies other than USD.

**Why not**: ServiceOpsIQ targets US-based industrial service companies. Multi-currency adds a
currency field to every financial entity, exchange rate lookups, realized/unrealized gain/loss
calculations, and complicates every sync point. QBO Online supports multi-currency but requires
a different API workflow. The complexity-to-market-size ratio is deeply unfavorable for v1.

**Cost**: High — touches every sync entity.
**Benefit**: Minimal for target market (GPS, US pump/HVAC/mechanical service).

---

### AF-03: QBO Payroll Integration

**What it is**: Syncing payroll runs from QBO Payroll into ServiceOpsIQ, or driving payroll
calculations from ServiceOpsIQ time data.

**Why not**: Payroll is a regulated domain (IRS, state tax withholding, garnishments). It
requires dedicated compliance expertise and audit trails that are outside ServiceOpsIQ's scope.
Employee sync (D-02) and time activity sync (D-01) feed the data QBO Payroll needs without
ServiceOpsIQ needing to touch the payroll run itself.

**Cost**: Extremely high — compliance surface, not just integration work.
**Benefit**: Addressed indirectly via D-01 and D-02.

---

### AF-04: QBO Payments Processing (Taking Payments via QBO API)

**What it is**: Processing customer credit card payments through QBO's payment processing API
from within ServiceOpsIQ.

**Why not**: This requires QBO Payments merchant account integration, PCI-DSS compliance scope,
card tokenization, and Intuit's payment partner certification. The customer portal already handles
payment links that open QBO's native payment flow. Attempting to embed payment capture in
ServiceOpsIQ would increase PCI scope dramatically with no meaningful UX advantage.

**Cost**: Extremely high — PCI-DSS scope, Intuit partner certification required.
**Benefit**: Addressed via portal payment links to QBO.

---

### AF-05: QuickBooks Desktop / Enterprise Sync

**What it is**: Supporting QBO Desktop (IIF file import) or QuickBooks Enterprise (separate API).

**Why not**: QBO Desktop API is a different, older integration path. ServiceOpsIQ's entire
integration is built on QBO REST API v3 (Online only). Desktop support would require a parallel
integration layer. Intuit is actively sunsetting Desktop in favor of Online. Target market for
$50K+ positioning is companies running QBO Online or QBO Advanced, not Desktop.

**Cost**: High — separate integration path.
**Benefit**: Shrinking market (Desktop sunset in progress).

---

### AF-06: Real-Time (Sub-Second) Sync

**What it is**: Synchronizing every change to QBO within seconds of it happening in ServiceOpsIQ.

**Why not**: QBO's API rate limit is 500 requests/minute per realm with 10 concurrent connections.
ServiceOpsIQ runs on Vercel serverless with 10s default / 60s max function limits. Real-time sync
would require a persistent queue worker (not serverless), and the QBO API does not support
webhooks for outbound triggers — only inbound. The correct architecture is: immediate async job
(sub-30s for critical paths like payment receipt), scheduled CDC poll (every 15 min for status
updates), and manual re-trigger for bulk operations.

**Cost**: Requires dedicated worker infrastructure, not serverless.
**Benefit**: Marginal — 15-min sync latency is acceptable for accounting use cases.

---

## Competitor Analysis

### ServiceTitan

**Pricing**: $398–$575/mo per tech (enterprise contract). The highest-priced FSM on the market.

**QBO Integration Strengths**:
- Full pricebook-to-QBO-Items mapping (hard prerequisite — blocks export until complete)
- Business unit → QBO Class mapping for P&L by division
- Purchase order → QBO Bill export (added 2025, marketed as enterprise feature)
- Journal entry generation for membership/contract revenue recognition
- Time tracking → payroll journal entries with business unit allocation
- Export batch workflow: ServiceTitan batches transactions and user manually approves export

**QBO Integration Weaknesses**:
- Batch-export model (not real-time) is a known pain point in reviews; creates delays
- Export errors block the entire batch — high administrative overhead
- Initial setup requires accountant involvement (mapping is complex)
- No QBO Reports API pullback into ServiceTitan

**Lesson for ServiceOpsIQ**: The batch-export model is a competitive weakness. ServiceOpsIQ's
event-driven push (webhook on invoice creation) is already better UX. Class tracking and
purchase order sync are where ServiceTitan wins at enterprise — those are D-06 and D-05.

---

### Jobber

**Pricing**: $69–$349/mo (Connect and Grow plans unlock QBO sync).

**QBO Integration Strengths**:
- Automatic, continuous sync (no manual batch trigger)
- Client, products/services, invoices, payments, refunds, tips, payouts all sync
- Initial bulk import from QBO on setup
- Sync activity dashboard with inline error resolution
- Automatic Sales Tax integration (US)
- Jobber Payments payout sync (including fee breakdown)

**QBO Integration Weaknesses**:
- One-way only (Jobber → QBO); QBO changes do not come back
- No time activity entities (timesheets appear as invoice line items only)
- No expense/bill sync — materials cost not reflected in QBO
- No class or location tracking
- No vendor or PO support
- No QBO Reports API

**Lesson for ServiceOpsIQ**: Jobber's sync dashboard UX is the gold standard for mid-market.
Copy the "alert in top nav → expandable sync activity log with per-error resolution steps" pattern
for TS-06. Everything Jobber does not do (bidirectional, class tracking, expense sync, Reports API)
is the enterprise tier opportunity.

---

### Housecall Pro

**Pricing**: $79–$299/mo. Primarily residential service (HVAC, plumbing, electrical).

**QBO Integration Strengths**:
- Syncs customers, tax rates, invoices, products/services, payments
- Classes (mapped as Business Units) synced to QBO Class entities
- Works with both QBO Online and Desktop

**QBO Integration Weaknesses**:
- Primarily one-way (Housecall Pro → QBO); initial import from QBO only
- No time activity sync
- No vendor, PO, or bill sync
- No employee sync
- No CDC / inbound ongoing sync
- Class tracking exists but setup is manual and frequently breaks

**Lesson for ServiceOpsIQ**: Housecall Pro targets residential; its class-tracking implementation
is fragile. ServiceOpsIQ's industrial/commercial target market (GPS, rotating equipment) has
stricter accounting requirements — job costing by asset/site is a real need.

---

### FieldPulse

**Pricing**: $99–$349/mo. Positioned as Jobber competitor for small-medium commercial service.

**QBO Integration Strengths**:
- Two-way sync (customers, invoices, payments — changes in either system sync back)
- QBO Time sync added 2025 (tags for holidays, breaks, overtime; notes on time punches)
- Tax override feature for point-of-sale tax calculation
- Items sync bidirectionally

**QBO Integration Weaknesses**:
- No expense/bill sync
- No PO sync
- No class or location tracking
- No QBO Reports API
- No employee sync distinct from customer-side contact records

**Lesson for ServiceOpsIQ**: FieldPulse's two-way sync (D-10 / customer inbound) is the feature
Jobber explicitly dropped. ServiceOpsIQ doing this well with proper conflict resolution would
match FieldPulse's key differentiator while adding features FieldPulse lacks (class, expense,
Reports API).

---

### Lexul Field Service (Niche Comparison)

**Pricing**: Contact for quote; enterprise positioning.

**QBO Integration Strengths**:
- Marketed as "ERP-level" QuickBooks integration
- Syncs time records, invoices, vendor bills, inventory
- Tight PO-to-bill matching
- Targets skilled trades and industrial service (closest to GPS market)

**QBO Integration Weaknesses**:
- Limited public documentation
- Smaller ecosystem and fewer integrations beyond QBO

**Lesson for ServiceOpsIQ**: Lexul's "ERP-level" framing for industrial service is the right
positioning analogy. The PO → Bill lifecycle (D-05 + D-03) is what industrial service buyers
evaluate. ServiceOpsIQ can match Lexul's core value proposition while offering the broader
feature set (custom reports, mobile app, analytics, portal).

---

## Feature Dependencies

This table defines the build order. Features that block others must ship first.

```
Level 0 (No dependencies — build first):
  TS-05  Chart of Accounts pull
  D-04   Vendor sync
  D-02   Employee sync

Level 1 (Depends on Level 0):
  TS-01  Payment receipt processing     (depends on: existing webhook)
  TS-03  Item / service sync            (depends on: TS-05)
  TS-06  Integration health dashboard   (depends on: existing QboSyncLog)
  D-12   Invoice email via QBO          (depends on: existing invoice push)
  D-10   Customer inbound sync          (depends on: TS-07 for ongoing; TS-05 for terms)

Level 2 (Depends on Level 1):
  TS-02  Invoice status bidirectional   (depends on: TS-01, TS-07)
  TS-04  Estimate / quote sync          (depends on: TS-03)
  D-11   Credit memo creation           (depends on: TS-02, TS-01)
  D-01   Time activity sync             (depends on: D-02, TS-03)
  D-03   Expense / bill sync            (depends on: D-04, TS-05)
  D-06   Class tracking                 (depends on: TS-05, TS-03)

Level 3 (Depends on Level 2):
  TS-07  CDC inbound sync               (depends on: TS-02, TS-03, TS-04, TS-05)
  D-05   Purchase order sync            (depends on: D-04, TS-05)
  D-07   Location / department          (depends on: D-06)
  D-08   QBO Reports API                (depends on: TS-05, D-06 for class P&L)
  D-09   Recurring invoices / PM        (depends on: existing PM cron, TS-04)
```

**Recommended Build Sequence** (delivering value fastest while respecting dependencies):

1. TS-05 (COA pull) — unblocks everything else; 1-2 hours
2. TS-01 (payment processing) — highest user impact; completes existing webhook; 2-4 hours
3. TS-06 (health dashboard) — immediately improves supportability; 4-6 hours
4. TS-03 (item sync) — required before estimate sync and expense sync; 4-6 hours
5. D-12 (invoice email via QBO) — low effort, high accountant satisfaction; 1-2 hours
6. TS-04 (estimate sync) — closes quote-to-invoice lifecycle; 4-6 hours
7. TS-02 (invoice status bidirectional) — requires TS-07 for inbound path
8. D-02 + D-04 (employee + vendor sync) — parallel, low complexity
9. D-01 (time activity sync) — requires D-02; enterprise differentiator
10. D-03 (expense / bill sync) — requires D-04; enterprise differentiator
11. D-06 (class tracking) — applied across all transactions; enterprise differentiator
12. TS-07 (CDC inbound) — combines with all prior outbound work for bidirectional parity
13. D-10 (customer inbound) — depends on CDC
14. D-11 (credit memo) — lower priority, accountant edge case
15. D-05 (purchase orders) — high value for industrial clients, higher complexity
16. D-07 (location tracking) — layered on class tracking
17. D-08 (QBO Reports API) — enterprise showcase feature
18. D-09 (recurring PM invoices) — completes the PM contract billing lifecycle

---

## Summary Table

| ID    | Feature                          | Category       | QBO Entity                        | Complexity | Enterprise? |
|-------|----------------------------------|----------------|-----------------------------------|------------|-------------|
| TS-05 | Chart of Accounts pull           | Table Stakes   | Account                           | Low        | No          |
| TS-01 | Payment receipt processing       | Table Stakes   | Payment (webhook)                 | Low        | No          |
| TS-06 | Integration health dashboard     | Table Stakes   | QboSyncLog (internal)             | Low        | No          |
| D-12  | Invoice email via QBO            | Differentiator | Invoice (send action)             | Low        | No          |
| TS-03 | Item / service sync              | Table Stakes   | Item                              | Medium     | No          |
| TS-04 | Estimate / quote sync            | Table Stakes   | Estimate, Invoice (LinkedTxn)     | Medium     | No          |
| TS-02 | Invoice status bidirectional     | Table Stakes   | Invoice, Payment                  | Medium     | No          |
| D-10  | Customer inbound sync            | Differentiator | Customer (CDC)                    | Medium     | No          |
| D-02  | Employee sync                    | Differentiator | Employee                          | Low-Med    | Yes         |
| D-04  | Vendor sync                      | Differentiator | Vendor                            | Low-Med    | Yes         |
| D-01  | Time activity sync               | Differentiator | TimeActivity                      | Medium     | Yes         |
| D-06  | Class tracking                   | Differentiator | Class (on all txns)               | Medium     | Yes         |
| D-11  | Credit memo creation             | Differentiator | CreditMemo                        | Medium     | Yes         |
| TS-07 | CDC inbound sync                 | Table Stakes   | CDC endpoint (multi-entity)       | Medium     | Yes         |
| D-03  | Expense / bill sync              | Differentiator | Bill, Purchase, Vendor            | High       | Yes         |
| D-05  | Purchase order sync              | Differentiator | PurchaseOrder                     | High       | Yes         |
| D-07  | Location / department tracking   | Differentiator | Department (on all txns)          | Medium     | Yes         |
| D-08  | QBO Reports API                  | Differentiator | Reports API (P&L, AR, BS)         | Medium     | Yes         |
| D-09  | Recurring invoice / PM billing   | Differentiator | RecurringTransaction / Invoice    | High       | Yes         |
| AF-01 | Bank deposit matching            | Anti-Feature   | —                                 | —          | —           |
| AF-02 | Multi-currency                   | Anti-Feature   | —                                 | —          | —           |
| AF-03 | QBO Payroll integration          | Anti-Feature   | —                                 | —          | —           |
| AF-04 | QBO Payments processing          | Anti-Feature   | —                                 | —          | —           |
| AF-05 | QuickBooks Desktop sync          | Anti-Feature   | —                                 | —          | —           |
| AF-06 | Real-time (sub-second) sync      | Anti-Feature   | —                                 | —          | —           |

---

*Sources consulted: ServiceTitan QBO help docs, Jobber QBO integration help center, Housecall Pro
QBO feature page, FieldPulse QBO integration articles, Lexul field service comparison, Atlas
Accounting Group, CapForge, Intuit Developer CDC documentation, Intuit API best practices blog.*
