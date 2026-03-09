# Roadmap: ServiceOpsIQ — QBO Full Integration

**Created:** 2026-03-08
**Phases:** 6
**Requirements:** 42 mapped

---

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | Foundation | Fix live bugs, add Prisma models, build core type/mapper/queue infrastructure | FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09 | 4 |
| 2 | Client Extensions + Account Mapping | Extend API client with batch/CDC/void/email methods; build Chart of Accounts pull and account mapping UI | FOUND-10, ACCT-01, ACCT-02, ACCT-03 | 3 |
| 3 | Core Outbound | Payment processing, item sync, estimate sync, webhook rewrite, integration health dashboard | PAY-01, PAY-03, QUOT-01, QUOT-02, ITEM-01, ITEM-02, VEND-02, SYNC-03, SYNC-04, DASH-01, DASH-02, DASH-03, DASH-05 | 5 |
| 4 | Inbound Sync | CDC polling engine, webhook dispatcher, bidirectional invoice/customer sync | PAY-02, SYNC-01, SYNC-02 | 3 |
| 5 | Enterprise Outbound | Employee, vendor, time activity, expense/bill, class tracking, credit memo | QUOT-03, VEND-01, TIME-01, TIME-02, EXP-01, DIM-01, DIM-03 | 4 |
| 6 | Enterprise Showcase | PO sync, location tracking, QBO Reports API, recurring PM invoices, token monitoring | PO-01, DIM-02, DIM-04, RPT-01, RPT-02, DASH-04 | 4 |

---

## Phase 1: Foundation

**Goal:** Fix the three live data-corruption bugs, pin the API version constant, add all required Prisma models and foreign-key fields, and write the type/mapper/queue modules that every subsequent phase depends on.

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09

### Requirements Detail

| ID | Description |
|----|-------------|
| FOUND-01 | Fix token refresh race condition — serialize refresh per connection via DB-level mutex |
| FOUND-02 | Fix sparse update data corruption — fetch full entity, merge changes, POST complete payload |
| FOUND-03 | Fix Decimal rounding — round to 2 decimal places before sending amounts to QBO |
| FOUND-04 | Pin minorversion=75 as named constant in all QBO API calls |
| FOUND-05 | Add Prisma models: QboSyncJob (durable queue), QboAccountMap (account mapping), QboCdcCursor (CDC timestamps) |
| FOUND-06 | Add fields to existing models: refreshTokenExpiry on QboConnection, qboEstimateId on Quote, qboItemId on Material/LaborRate, qboTimeActivityId on TimeEntry, qboVendorId on vendor records |
| FOUND-07 | Create qbo-types.ts with TypeScript interfaces for all QBO entity types |
| FOUND-08 | Create qbo-mapper.ts — pure transformation functions (ServiceOps <-> QBO), no I/O |
| FOUND-09 | Create qbo-queue.ts — enqueue, claim, complete, fail, stale-lock detection helpers |

### Success Criteria

1. A concurrent load test against `getValidAccessToken()` produces zero `invalid_grant` errors — only one invocation performs the refresh, others wait and receive the new token.
2. After `updateCustomer()` runs, the QBO record retains all previously set fields (phone, address, payment terms) — no fields are cleared by a sync that only changed email.
3. All QBO API calls in the codebase reference the `QBO_API_VERSION` constant (value `75`) — no hardcoded minorversion strings remain.
4. `npx prisma migrate dev` completes without error; `QboSyncJob`, `QboAccountMap`, and `QboCdcCursor` tables exist in the database with correct columns and constraints.

---

## Phase 2: Client Extensions + Account Mapping

**Goal:** Extend `qbo-client.ts` with the batch, CDC, void, and email HTTP methods that all sync modules require; pull the org's Chart of Accounts from QBO and provide an admin UI to map ServiceOps financial categories to specific QBO accounts — the prerequisite gate that blocks all financial transaction syncs until configured.

**Requirements:** FOUND-10, ACCT-01, ACCT-02, ACCT-03

### Requirements Detail

| ID | Description |
|----|-------------|
| FOUND-10 | Extend qbo-client.ts with batchRequest(), queryEntities(), cdcRequest(), voidInvoice(), sendInvoiceEmail() |
| ACCT-01 | Chart of Accounts pull — fetch and cache org's QBO account list on connect and on-demand refresh |
| ACCT-02 | Account mapping UI — admin interface to map ServiceOps financial categories (income accounts for labor/materials/service, expense accounts for job costs) to specific QBO accounts |
| ACCT-03 | Account mapping prerequisite gate — block any financial transaction sync that lacks configured account mapping, surface clear error in dashboard |

### Success Criteria

1. Calling `batchRequest()` with 30 operations sends a single HTTP request to QBO's batch endpoint and returns a structured response array — no individual-entity API calls are made when a batch is possible.
2. The `/integrations/qbo/settings` page shows a "Chart of Accounts" section listing all QBO accounts fetched from the live connection, with a Refresh button that re-fetches on demand.
3. An admin can select a QBO income account for "Labor", "Materials", and "Service Fees" and a QBO expense account for "Job Costs" — these selections persist in `QboAccountMap` and survive page reload.
4. Attempting to sync an invoice for an org with no account mapping configured returns a clear dashboard error ("Account mapping required — configure in QBO Settings") rather than silently posting to Uncategorized Income.

---

## Phase 3: Core Outbound

**Status:** In Progress — Plan 01 complete (5 commits), Plans 02-05 remaining

**Goal:** Deliver the table-stakes integration features: payment receipt processing, item/service sync (with correct ItemRef on invoices), estimate/quote sync, invoice email via QBO, webhook idempotency rewrite, and the integration health dashboard.

**Requirements:** PAY-01, PAY-03, QUOT-01, QUOT-02, ITEM-01, ITEM-02, VEND-02, SYNC-03, SYNC-04, DASH-01, DASH-02, DASH-03, DASH-05

### Requirements Detail

| ID | Description |
|----|-------------|
| PAY-01 | Payment receipt processing — webhook receives QBO Payment event, fetches payment details, matches to ServiceOps invoice(s), marks PAID with amount, date, and method |
| PAY-03 | Invoice email via QBO API — send invoices through QBO's email endpoint so they appear in QBO's sent history and support QBO Payments flow |
| QUOT-01 | Estimate/Quote sync — push ServiceOps quotes to QBO as Estimates with line items and customer reference |
| QUOT-02 | Estimate-to-Invoice conversion — when a synced quote converts to invoice, use QBO LinkedTxn to create invoice from estimate (not standalone) |
| ITEM-01 | Item/Service sync — sync ServiceOps materials and labor rates to QBO Items with income/expense account assignments from account mapping |
| ITEM-02 | ItemRef on invoice line items — every synced invoice line item references a valid QBO Item (fixes live bug of revenue posting to Uncategorized Income) |
| VEND-02 | DisplayName collision handling — query-before-create on all named entities; on collision append ServiceOps ID suffix or offer to link existing QBO record |
| SYNC-03 | Webhook dispatcher rewrite — return 200 immediately, deduplicate via unique constraint, defer processing to sync queue |
| SYNC-04 | Webhook idempotency — unique constraint on (realmId, entityType, entityId, operation, eventTimestamp) prevents duplicate processing |
| DASH-01 | Integration health dashboard — connection status, last sync timestamps per entity type, pending/failed/success counts |
| DASH-02 | Sync error log with resolution hints — display QboSyncLog errors with actionable guidance and manual re-trigger buttons |
| DASH-03 | Manual sync triggers — admin can trigger full or entity-specific sync on demand |
| DASH-05 | Queue flush cron — process 30 queued sync jobs every 5 minutes via Vercel Cron |

### Success Criteria

1. When QBO fires a Payment webhook, the corresponding ServiceOpsIQ invoice status changes to PAID within 5 minutes and displays the payment amount, date, and method — with no duplicate payment records on webhook re-delivery.
2. Syncing a material catalog of 50 items to QBO produces 50 QBO Item records, each with a valid income account reference from the account mapping — the QBO P&L shows revenue in the correct accounts, not in Uncategorized Income.
3. A ServiceOpsIQ quote pushed to QBO appears as a QBO Estimate; when that quote is subsequently approved and converted to an invoice, the resulting QBO Invoice contains a `LinkedTxn` reference to the originating Estimate.
4. The `/integrations/qbo/health` dashboard page shows connection status, last-synced timestamps for each entity type, and a filterable error log with actionable error descriptions and per-error re-trigger buttons.
5. The webhook route returns HTTP 200 within 200ms of receipt regardless of QBO API latency — processing is deferred to the `qbo-flush` cron queue.

---

## Phase 4: Inbound Sync

**Goal:** Close the bidirectional sync loop: CDC polling engine pulls all QBO entity changes every 4 hours, the full webhook dispatcher processes Payment and Invoice events correctly, and customer records flow from QBO into ServiceOpsIQ with conflict resolution.

**Requirements:** PAY-02, SYNC-01, SYNC-02

### Requirements Detail

| ID | Description |
|----|-------------|
| PAY-02 | Invoice status bidirectional sync — QBO voids, partial payments, and balance changes reflect in ServiceOps; ServiceOps cancellations void the QBO invoice |
| SYNC-01 | CDC polling engine — Vercel Cron every 4 hours calls QBO /cdc endpoint for all changed entities since lastPollAt per org |
| SYNC-02 | Customer inbound sync — pull new/updated customers from QBO into ServiceOps via CDC with conflict resolution (ServiceOps wins operational fields, QBO wins billing fields) |

### Success Criteria

1. Voiding an invoice in QBO results in the corresponding ServiceOpsIQ invoice being marked CANCELLED within the next CDC poll cycle (max 4 hours); cancelling a ServiceOpsIQ invoice immediately voids (not deletes) the QBO invoice via the void API call.
2. The `/api/cron/qbo-cdc` route processes all changed entities for all connected orgs in a single invocation and updates `QboCdcCursor.lastPollAt` — subsequent polls only fetch changes since the last successful poll.
3. A new customer created in QBO appears as a ServiceOpsIQ customer within 4 hours; if the same customer was updated in both systems, ServiceOpsIQ retains its operational fields (site address, contact name) and adopts QBO's billing fields (payment terms), with the conflict decision logged in `QboSyncLog`.

---

## Phase 5: Enterprise Outbound

**Goal:** Deliver the enterprise differentiators that separate $50K+ positioning from SMB tools: employee and vendor sync, time activity and expense/bill sync, class tracking on all transactions, and credit memo creation.

**Requirements:** QUOT-03, VEND-01, TIME-01, TIME-02, EXP-01, DIM-01, DIM-03

### Requirements Detail

| ID | Description |
|----|-------------|
| QUOT-03 | Credit memo creation — create CreditMemo in QBO linked to original invoice via LinkedTxn when refunds/credits issued |
| VEND-01 | Vendor sync — sync ServiceOps suppliers/vendors to QBO Vendors with 1099 tracking flag |
| TIME-01 | Employee sync — map ServiceOps technicians to QBO Employee entities |
| TIME-02 | Time activity sync — push ServiceOps time entries to QBO TimeActivity linked to Employee, Customer, and Service Item with billable/non-billable classification |
| EXP-01 | Expense/Bill sync — push job material costs and expenses to QBO as Bills or Purchases with vendor reference and account categorization |
| DIM-01 | Class tracking — apply QBO Classes (by service line/work type) to all synced transactions (invoices, bills, time activities, payments) |
| DIM-03 | Preferences check — verify Class and Location tracking are enabled in QBO company settings before sending ClassRef/DepartmentRef; surface setting in dashboard |

### Success Criteria

1. A technician clocking out of a work order produces a QBO `TimeActivity` record linked to the correct QBO Employee, the job's QBO Customer, and a billable/non-billable flag matching the ServiceOpsIQ time entry — no manual re-entry in QBO is needed for payroll prep.
2. A material expense entered on a work order syncs to QBO as a Bill (when a vendor is specified) or a Purchase (when no vendor is specified), with the expense account from account mapping — the job P&L is visible in QBO without manual journal entries.
3. A credit memo issued in ServiceOpsIQ creates a QBO `CreditMemo` entity with a `LinkedTxn` reference to the original invoice, and the customer's QBO balance decreases by the credit amount.
4. When QBO Class tracking is enabled in company preferences, every synced invoice, bill, and time activity carries the correct `ClassRef` for its work type; when Class tracking is disabled, the integration dashboard shows a warning and omits `ClassRef` silently — no QBO API errors occur.

---

## Phase 6: Enterprise Showcase

**Goal:** Complete the enterprise feature set with purchase order sync, location/department tracking layered on class infrastructure, QBO financial reports embedded in the analytics dashboard, recurring PM invoice automation, and proactive token expiry monitoring.

**Requirements:** PO-01, DIM-02, DIM-04, RPT-01, RPT-02, DASH-04

### Requirements Detail

| ID | Description |
|----|-------------|
| PO-01 | Purchase order sync — push ServiceOps purchase orders to QBO for three-way PO → Receipt → Bill matching |
| DIM-02 | Location/Department tracking — apply QBO Locations to all synced transactions for P&L by site/region |
| DIM-04 | Recurring PM invoices — ServiceOps PM cron generates standard QBO invoices on each PM cycle (not QBO recurring templates, which have no API) |
| RPT-01 | QBO Reports API — pull P&L, A/R Aging, and Balance Sheet from QBO and embed in ServiceOps analytics dashboard |
| RPT-02 | Reports date range and filter support — allow users to specify date ranges, accounting method (Cash/Accrual), and class/location filters |
| DASH-04 | Proactive token expiry monitoring — nightly cron refreshes tokens expiring within 14 days; on invalid_grant, mark connection inactive and alert admin with reconnect link |

### Success Criteria

1. A purchase order created in ServiceOpsIQ appears in QBO as a PurchaseOrder entity; when the corresponding bill is received, QBO can perform three-way PO → Receipt → Bill matching without manual intervention.
2. The ServiceOpsIQ analytics dashboard displays a QBO Financial Reports tab showing P&L, A/R Aging, and Balance Sheet pulled live from QBO, with date range pickers and Cash/Accrual toggle — no separate QBO login is required to view financial reports.
3. When a PM work order is generated by the nightly cron and marked complete, a corresponding QBO invoice is created automatically — the business owner sees the PM billing in QBO without any manual invoice creation.
4. A nightly cron job identifies all QBO connections with refresh tokens expiring within 14 days, proactively refreshes them, and sends an admin email alert with a reconnect link if the refresh fails — no org silently loses its QBO connection due to the 100-day expiry cliff.

---

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| FOUND-01 | 1 |
| FOUND-02 | 1 |
| FOUND-03 | 1 |
| FOUND-04 | 1 |
| FOUND-05 | 1 |
| FOUND-06 | 1 |
| FOUND-07 | 1 |
| FOUND-08 | 1 |
| FOUND-09 | 1 |
| FOUND-10 | 2 |
| ACCT-01 | 2 |
| ACCT-02 | 2 |
| ACCT-03 | 2 |
| PAY-01 | 3 |
| PAY-02 | 4 |
| PAY-03 | 3 |
| QUOT-01 | 3 |
| QUOT-02 | 3 |
| QUOT-03 | 5 |
| ITEM-01 | 3 |
| ITEM-02 | 3 |
| VEND-01 | 5 |
| VEND-02 | 3 |
| PO-01 | 6 |
| TIME-01 | 5 |
| TIME-02 | 5 |
| EXP-01 | 5 |
| DIM-01 | 5 |
| DIM-02 | 6 |
| DIM-03 | 5 |
| DIM-04 | 6 |
| SYNC-01 | 4 |
| SYNC-02 | 4 |
| SYNC-03 | 3 |
| SYNC-04 | 3 |
| RPT-01 | 6 |
| RPT-02 | 6 |
| DASH-01 | 3 |
| DASH-02 | 3 |
| DASH-03 | 3 |
| DASH-04 | 6 |
| DASH-05 | 3 |

**Total mapped: 42 / 42**

---

*Created: 2026-03-08*
