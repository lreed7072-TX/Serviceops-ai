# Requirements: ServiceOpsIQ — QBO Full Integration

**Defined:** 2026-03-07
**Core Value:** Every financial transaction in ServiceOpsIQ must flow to QBO automatically and accurately, so the business owner never double-enters data and their books are always current.

## v1 Requirements

Requirements for QBO Full Integration milestone. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: Fix token refresh race condition — serialize refresh per connection via DB-level mutex
- [ ] **FOUND-02**: Fix sparse update data corruption — fetch full entity, merge changes, POST complete payload
- [ ] **FOUND-03**: Fix Decimal rounding — round to 2 decimal places before sending amounts to QBO
- [ ] **FOUND-04**: Pin minorversion=75 as named constant in all QBO API calls
- [ ] **FOUND-05**: Add Prisma models: QboSyncJob (durable queue), QboAccountMap (account mapping), QboCdcCursor (CDC timestamps)
- [ ] **FOUND-06**: Add fields to existing models: refreshTokenExpiry on QboConnection, qboEstimateId on Quote, qboItemId on Material/LaborRate, qboTimeActivityId on TimeEntry, qboVendorId on vendor records
- [ ] **FOUND-07**: Create qbo-types.ts with TypeScript interfaces for all QBO entity types
- [ ] **FOUND-08**: Create qbo-mapper.ts — pure transformation functions (ServiceOps ↔ QBO), no I/O
- [ ] **FOUND-09**: Create qbo-queue.ts — enqueue, claim, complete, fail, stale-lock detection helpers
- [ ] **FOUND-10**: Extend qbo-client.ts with batchRequest(), queryEntities(), cdcRequest(), voidInvoice(), sendInvoiceEmail()

### Payment & Invoice

- [ ] **PAY-01**: Payment receipt processing — webhook receives QBO Payment event, fetches payment details, matches to ServiceOps invoice(s), marks PAID with amount, date, and method
- [ ] **PAY-02**: Invoice status bidirectional sync — QBO voids, partial payments, and balance changes reflect in ServiceOps; ServiceOps cancellations void the QBO invoice
- [ ] **PAY-03**: Invoice email via QBO API — send invoices through QBO's email endpoint so they appear in QBO's sent history and support QBO Payments flow

### Quotes & Credits

- [ ] **QUOT-01**: Estimate/Quote sync — push ServiceOps quotes to QBO as Estimates with line items and customer reference
- [ ] **QUOT-02**: Estimate-to-Invoice conversion — when a synced quote converts to invoice, use QBO LinkedTxn to create invoice from estimate (not standalone)
- [ ] **QUOT-03**: Credit memo creation — create CreditMemo in QBO linked to original invoice via LinkedTxn when refunds/credits issued

### Account Mapping

- [ ] **ACCT-01**: Chart of Accounts pull — fetch and cache org's QBO account list on connect and on-demand refresh
- [ ] **ACCT-02**: Account mapping UI — admin interface to map ServiceOps financial categories (income accounts for labor/materials/service, expense accounts for job costs) to specific QBO accounts
- [ ] **ACCT-03**: Account mapping prerequisite gate — block any financial transaction sync that lacks configured account mapping, surface clear error in dashboard

### Items & Vendors

- [ ] **ITEM-01**: Item/Service sync — sync ServiceOps materials and labor rates to QBO Items with income/expense account assignments from account mapping
- [ ] **ITEM-02**: ItemRef on invoice line items — every synced invoice line item references a valid QBO Item (fixes live bug of revenue posting to Uncategorized Income)
- [ ] **VEND-01**: Vendor sync — sync ServiceOps suppliers/vendors to QBO Vendors with 1099 tracking flag
- [ ] **VEND-02**: DisplayName collision handling — query-before-create on all named entities; on collision append ServiceOps ID suffix or offer to link existing QBO record
- [ ] **PO-01**: Purchase order sync — push ServiceOps purchase orders to QBO for three-way PO → Receipt → Bill matching

### Time & Employees

- [ ] **TIME-01**: Employee sync — map ServiceOps technicians to QBO Employee entities
- [ ] **TIME-02**: Time activity sync — push ServiceOps time entries to QBO TimeActivity linked to Employee, Customer, and Service Item with billable/non-billable classification
- [ ] **EXP-01**: Expense/Bill sync — push job material costs and expenses to QBO as Bills or Purchases with vendor reference and account categorization

### Dimensional Tracking

- [ ] **DIM-01**: Class tracking — apply QBO Classes (by service line/work type) to all synced transactions (invoices, bills, time activities, payments)
- [ ] **DIM-02**: Location/Department tracking — apply QBO Locations to all synced transactions for P&L by site/region
- [ ] **DIM-03**: Preferences check — verify Class and Location tracking are enabled in QBO company settings before sending ClassRef/DepartmentRef; surface setting in dashboard
- [ ] **DIM-04**: Recurring PM invoices — ServiceOps PM cron generates standard QBO invoices on each PM cycle (not QBO recurring templates, which have no API)

### Inbound Sync

- [ ] **SYNC-01**: CDC polling engine — Vercel Cron every 4 hours calls QBO /cdc endpoint for all changed entities since lastPollAt per org
- [ ] **SYNC-02**: Customer inbound sync — pull new/updated customers from QBO into ServiceOps via CDC with conflict resolution (ServiceOps wins operational fields, QBO wins billing fields)
- [ ] **SYNC-03**: Webhook dispatcher rewrite — return 200 immediately, deduplicate via unique constraint, defer processing to sync queue
- [ ] **SYNC-04**: Webhook idempotency — unique constraint on (realmId, entityType, entityId, operation, eventTimestamp) prevents duplicate processing

### Reporting

- [ ] **RPT-01**: QBO Reports API — pull P&L, A/R Aging, and Balance Sheet from QBO and embed in ServiceOps analytics dashboard
- [ ] **RPT-02**: Reports date range and filter support — allow users to specify date ranges, accounting method (Cash/Accrual), and class/location filters

### Dashboard & Settings

- [ ] **DASH-01**: Integration health dashboard — connection status, last sync timestamps per entity type, pending/failed/success counts
- [ ] **DASH-02**: Sync error log with resolution hints — display QboSyncLog errors with actionable guidance and manual re-trigger buttons
- [ ] **DASH-03**: Manual sync triggers — admin can trigger full or entity-specific sync on demand
- [ ] **DASH-04**: Proactive token expiry monitoring — nightly cron refreshes tokens expiring within 14 days; on invalid_grant, mark connection inactive and alert admin with reconnect link
- [ ] **DASH-05**: Queue flush cron — process 30 queued sync jobs every 5 minutes via Vercel Cron

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Advanced Sync

- **ADV-01**: Real-time sub-second sync (requires persistent worker, incompatible with Vercel serverless)
- **ADV-02**: Batch initial sync wizard (import all QBO data on first connect)
- **ADV-03**: Sync conflict resolution UI (manual override for bidirectional conflicts)

### Extended Entities

- **EXT-01**: QBO Project sync (ServiceOps work orders → QBO Projects)
- **EXT-02**: Journal entry creation for complex accounting adjustments
- **EXT-03**: Tax code sync and automated sales tax on invoices

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bank deposit matching | QBO handles natively with ML matching; requires Plaid + PCI compliance surface area |
| Multi-currency support | US-market only; touches every financial entity, extreme complexity-to-value ratio |
| QBO Payroll integration | Regulated compliance domain; Employee + Time Activity sync feeds QBO Payroll without touching payroll runs |
| QBO Payments processing | Requires PCI-DSS scope; portal payment links already route to QBO's native flow |
| QuickBooks Desktop sync | Different integration path; Intuit actively sunsetting Desktop; target market runs QBO Online/Advanced |
| QBO recurring transaction templates | No REST API exists for this; implemented as ServiceOps cron + standard invoice push instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| FOUND-07 | Phase 1 | Pending |
| FOUND-08 | Phase 1 | Pending |
| FOUND-09 | Phase 1 | Pending |
| FOUND-10 | Phase 2 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 4 | Pending |
| PAY-03 | Phase 3 | Pending |
| QUOT-01 | Phase 3 | Pending |
| QUOT-02 | Phase 3 | Pending |
| QUOT-03 | Phase 5 | Pending |
| ACCT-01 | Phase 2 | Pending |
| ACCT-02 | Phase 2 | Pending |
| ACCT-03 | Phase 2 | Pending |
| ITEM-01 | Phase 3 | Pending |
| ITEM-02 | Phase 3 | Pending |
| VEND-01 | Phase 5 | Pending |
| VEND-02 | Phase 3 | Pending |
| PO-01 | Phase 6 | Pending |
| TIME-01 | Phase 5 | Pending |
| TIME-02 | Phase 5 | Pending |
| EXP-01 | Phase 5 | Pending |
| DIM-01 | Phase 5 | Pending |
| DIM-02 | Phase 6 | Pending |
| DIM-03 | Phase 5 | Pending |
| DIM-04 | Phase 6 | Pending |
| SYNC-01 | Phase 4 | Pending |
| SYNC-02 | Phase 4 | Pending |
| SYNC-03 | Phase 3 | Pending |
| SYNC-04 | Phase 3 | Pending |
| RPT-01 | Phase 6 | Pending |
| RPT-02 | Phase 6 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after initial definition*
