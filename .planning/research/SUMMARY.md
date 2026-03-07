# Research Summary: QBO Full Integration

_Synthesized: 2026-03-07 | Sources: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md_

---

## Key Findings

- **The existing code has 3 live bugs that corrupt data in production right now**: (1) `updateCustomer()` performs a sparse update that silently clears phone numbers and addresses on every sync, (2) `getValidAccessToken()` has a token refresh race condition that can permanently invalidate a refresh token under concurrent load, and (3) invoice line items are pushed without `ItemRef`, causing revenue to post to Uncategorized Income in QBO. These must be fixed before any new sync points are built.
- **Item/Service sync and Chart of Accounts mapping are the foundational prerequisites** — they block estimate sync, expense/bill sync, time activity sync, and correct invoice line items. Nothing meaningful can ship until these two features are complete.
- **The webhook handler must be made idempotent and async before payment processing is activated** — the current skeleton does synchronous processing inline, which will produce duplicate records and timeout failures once real QBO API calls are added.
- **QBO's Recurring Transaction API does not exist** — the recurring invoice / PM billing feature must be implemented entirely as a ServiceOpsIQ cron that pushes regular invoices; QBO recurring templates cannot be created or managed via API.
- **Class tracking, expense/bill sync, and the QBO Reports API pullback are the enterprise differentiators** that justify $50K+ positioning and that no mid-market competitor (Jobber, Housecall Pro, FieldPulse) fully implements — these are the features to lead with in sales demos.

---

## Stack Decision

The existing stack is correct and requires only additive changes. Keep the raw `fetch`-based `qboRequest()` wrapper in `qbo-client.ts` — it is typed, serverless-safe, and already handles auth headers and sandbox/production URL switching. Do not introduce `node-quickbooks` (no TypeScript types, incompatible with serverless token management) or BullMQ/Redis (requires persistent worker infrastructure incompatible with Vercel). Extend the existing client with `batchRequest()`, `queryEntities()`, and `cdcRequest()` helpers. Add the `intuit-oauth` package only if Intuit's production app review or token collision bugs require it. Use a Prisma-based `QboSyncJob` table as the durable queue (no Redis needed at this traffic scale), Vercel Cron for CDC polling and queue flush, and a `QboCdcCursor` table to track poll timestamps per org. Pin `minorversion=75` as a named constant across all API calls — versions below 75 are deprecated by Intuit as of August 1, 2025.

---

## Table Stakes (Must Ship)

These are non-negotiable for any buyer at any serious price point. All four benchmarked competitors (ServiceTitan, Jobber, Housecall Pro, FieldPulse) have these.

1. **TS-05 — Chart of Accounts Pull**: Pull and cache the org's QBO account list on connect. Required before item mapping, expense sync, or time activity sync can be configured. Build first — it unblocks everything else. (Low complexity, 1-2 hours)
2. **TS-01 — Payment Receipt Processing**: Complete the existing webhook handler skeleton. When QBO fires a Payment event, mark the ServiceOpsIQ invoice PAID with amount, date, and method. The #1 complaint in FSM + QBO integration reviews is invoices stuck as "unpaid" indefinitely. (Low complexity, 2-4 hours)
3. **TS-06 — Integration Health Dashboard**: Surface `QboSyncLog` data (already in schema) in a dedicated UI: connection status, last sync timestamps per entity, error log with resolution hints, manual re-trigger buttons, and pending/failed/success counts. Without this, support tickets explode. Model Jobber's "alert in top nav → expandable sync activity log" UX pattern. (Low complexity, 4-6 hours)
4. **TS-03 — Item / Service Sync**: Sync ServiceOpsIQ materials and labor rates to QBO Items (Products & Services) with income account assignments. Every invoice line item must reference a valid `ItemRef` for GL posting to work correctly — this is also the fix for the live bug where revenue posts to Uncategorized Income. (Medium complexity, 4-6 hours)
5. **TS-04 — Estimate / Quote Sync**: Sync ServiceOpsIQ quotes to QBO Estimates. When a quote converts to an invoice, use QBO's `LinkedTxn` reference to create the invoice from the estimate — never create a standalone invoice for a record that has a corresponding synced estimate. (Medium complexity, 4-6 hours)
6. **TS-02 — Invoice Status Bidirectional Sync**: Voids, partial payments, credit memos, and balance changes in QBO reflect back to ServiceOpsIQ. ServiceOpsIQ cancellations void (not delete) the QBO invoice via `?operation=void`. (Medium complexity, depends on TS-01 and TS-07)
7. **TS-07 — CDC Inbound Sync**: Vercel Cron polling the QBO `/cdc` endpoint every 4 hours to pull all changed entities (Invoice, Customer, Item, Payment, Estimate) since `lastPollAt`. Single API call covers all entity types per org. Dual-path with webhooks: webhooks for latency, CDC for correctness. (Medium complexity, depends on TS-02 through TS-05)

---

## Differentiators (Enterprise Value)

Features that separate $50K+ enterprise positioning from $5K/yr SMB tools. ServiceTitan partially implements some; no mid-market competitor implements all.

1. **D-02 + D-04 — Employee and Vendor Sync**: Sync technicians to QBO Employees and suppliers to QBO Vendors. Prerequisites for time activity and expense sync respectively. Low-medium complexity; high leverage for everything below.
2. **D-01 — Time Activity Sync (Technician Hours → QBO TimeActivity)**: Map ServiceOpsIQ time entries to QBO `TimeActivity` entities linked to employee and customer. Enables labor cost reports, payroll prep exports, and job-level time analysis without re-entry. Jobber does not do this (timesheets appear as invoice line items only). Requires Employee sync first.
3. **D-03 + D-05 — Expense / Bill Sync and Purchase Order Sync**: Job materials consumed → QBO Bills or Purchases; POs created in ServiceOpsIQ sync to QBO for three-way PO → Receipt → Bill matching. Closes the accounts payable loop, making job P&L visible. ServiceTitan added PO export as a 2025 enterprise differentiator. Lexul markets this as its key ERP-level feature. Highest complexity; highest enterprise impact.
4. **D-06 + D-07 — Class and Location Tracking on All Transactions**: Apply QBO Classes (by service line / division) and Departments (by location) to every synced transaction — invoices, bills, time activities, payments. Enables P&L by division and by site. ServiceTitan's business-unit-to-class mapping is its primary enterprise differentiator. Requires QBO Plus for Class, QBO Advanced for Location. Must check `GET /preferences` for `ClassTrackingPerTransaction` before sending ClassRef — QBO silently ignores it if not enabled.
5. **D-08 — QBO Reports API Integration**: Pull P&L, AR Aging, Balance Sheet, and Revenue by Customer directly from QBO Reports API and embed them in the ServiceOpsIQ analytics dashboard alongside operational metrics. No mid-market FSM tool does this. Delivers a single command center that a business owner or controller cannot get anywhere else at this price point. Strong demo moment.
6. **D-10 — Customer Inbound Sync (QBO → ServiceOps)**: Bidirectional customer sync via CDC. Jobber explicitly dropped inbound sync after their 2023 integration rewrite; FieldPulse added it and markets it as a differentiator. Conflict resolution: ServiceOpsIQ wins on operational fields (site address, contact name); QBO wins on billing fields (payment terms, tax code).
7. **D-11 + D-12 — Credit Memos and Invoice Email via QBO**: Credit memos linked to original invoices via `LinkedTxn`; "Send via QBO" toggle so invoice emails originate from the business's QBO account for QBO Payments flow. Low effort, high accountant satisfaction.
8. **D-09 — Recurring PM Invoices**: ServiceOpsIQ PM cron generates standard QBO invoices on each PM cycle — not QBO recurring templates (which have no API). Eliminates the most error-prone manual process for retainer maintenance contracts.

---

## Architecture Highlights

- **Module split**: The current 2-file `src/lib/qbo/` directory expands to 8 focused modules — `qbo-client.ts` (HTTP, OAuth, token), `qbo-types.ts` (all entity interfaces), `qbo-mapper.ts` (pure transformation, no I/O — fully testable), `qbo-account-map.ts` (account mapping resolution), `qbo-outbound.ts` (all push functions), `qbo-inbound.ts` (all pull handlers), `qbo-cdc.ts` (CDC poll engine), `qbo-webhook.ts` (full webhook dispatcher), `qbo-queue.ts` (job queue helpers). Existing `qbo-sync.ts` refactors into thin wrappers delegating to `qbo-outbound.ts` — preserving public API for callers until all import sites are updated.
- **Durable queue via Prisma**: `QboSyncJob` table with atomic job claiming via `UPDATE WHERE status='pending' LIMIT 30 RETURNING *`. No Redis. Priority levels: 1 = real-time user-triggered pushes, 5 = CDC-driven inbound, 9 = bulk initial sync. Stale lock detection: jobs locked >120 seconds reset to pending at start of each cron run. Dead letter after 3 attempts, surfaced in health dashboard with manual re-queue option.
- **Dual-path inbound sync**: Webhooks deliver near-real-time events (Payment, Invoice); CDC polling every 4 hours provides the correctness backstop for anything the webhook missed (delayed delivery, network drops, out-of-order events). Both paths write idempotent upserts to the same Prisma models.
- **Conflict resolution for bidirectional entities** (Customer, Item): Compare QBO `MetaData.LastUpdatedTime` against ServiceOpsIQ `qboSyncedAt`. If QBO is newer, accept QBO values and advance `qboSyncedAt`. If ServiceOpsIQ is newer, skip the CDC update. Log the decision (`winner: "qbo" | "serviceops"`) to prevent infinite update loops.
- **Account mapping as a prerequisite gate**: `qbo-account-map.ts:resolveAccount(orgId, category)` blocks any financial transaction sync that lacks a configured income/expense account mapping, surfacing a clear error in the integration dashboard. This prevents silent GL misposting.
- **New Prisma models required**: `QboSyncJob` (queue), `QboAccountMap` (user-configured account assignments), `QboCdcCursor` (last poll timestamp per org). New fields on existing models: `qboEstimateId` on Quote, `qboItemId` on Material and LaborRate, `qboTimeActivityId` on Visit, `qboVendorId` on Vendor, `refreshTokenExpiry` on QboConnection.
- **New cron routes in vercel.json**: `*/5 * * * *` → `/api/cron/qbo-flush` (queue processor, 30 jobs/run), `0 */4 * * *` → `/api/cron/qbo-cdc` (CDC poll).

---

## Critical Pitfalls to Prevent

1. **Sparse update silently clears QBO entity fields (LIVE BUG)**: The current `updateCustomer()` sends only changed fields, which causes QBO to clear all omitted fields (phone, address, payment terms). Fix: always fetch the full entity first, merge changes into the complete payload, then POST the merged object. Apply this pattern to every entity type. Fix before any new update operations are added.
2. **Token refresh race condition (LIVE BUG)**: Two concurrent serverless invocations can both detect an expired access token and both call `refreshAccessToken()`. QBO refresh tokens are single-use — the second writer invalidates the first's new token, permanently breaking the connection. Fix: use `SELECT FOR UPDATE SKIP LOCKED` or an atomic `refreshInProgress` flag on `QboConnection` to serialize token refresh per connection.
3. **100-day refresh token expiry cliff**: Refresh tokens expire after 100 days of disuse with no warning. Fix: store `refreshTokenExpiry` on `QboConnection`, build a nightly cron that proactively refreshes tokens expiring within 14 days, and on `invalid_grant` immediately mark the connection inactive and send an admin alert with a reconnect link.
4. **Webhook handler is not idempotent and processes inline (LIVE RISK)**: QBO delivers webhooks with 5-minute minimum delay, out-of-order, and potentially more than once. The current handler processes synchronously. Fix: return HTTP 200 immediately, deduplicate via a table with unique constraint on `(realmId, entityType, entityId, operationType, eventTimestamp)`, and defer all processing to the sync queue or `waitUntil()`.
5. **SyncToken conflicts on concurrent updates**: Two invocations reading the same SyncToken and both attempting an update — one will fail with HTTP 400 "Stale Object" (QBO fault code 6000/6140). Fix: build `qboUpdateWithRetry()` wrapper that re-fetches SyncToken on stale error and retries up to 3 times. Never cache SyncToken values in the database.
6. **DisplayName uniqueness is global across all entity types in a QBO realm**: Customer "Smith Contracting" and Vendor "Smith Contracting" cannot coexist. Fix: query-before-create on all named entity types; on collision, append ServiceOps internal ID suffix (e.g., `[SO-4421]`) or offer to link to the existing QBO record.
7. **Class and Location tracking silently no-ops if not enabled in QBO company settings**: QBO accepts ClassRef and DepartmentRef fields without error but ignores them if the company has not enabled tracking in Account and Settings. Fix: call `GET /preferences` before syncing any Class or Location reference; surface the detected setting in the integration dashboard and omit the fields if tracking is disabled.

---

## Live Bugs in Existing Code

The following issues are in the current `qbo-client.ts` / `qbo-sync.ts` and must be fixed before the integration expands:

| # | File | Location | Bug | Impact |
|---|---|---|---|---|
| 1 | `qbo-client.ts` | `getValidAccessToken()` | No mutex on token refresh — concurrent invocations can both refresh, the second invalidates the first's new refresh token | Permanent connection loss under concurrent load; `invalid_grant` errors |
| 2 | `qbo-client.ts` | `updateCustomer()` | Sends partial payload (only DisplayName + email) — QBO replaces entire entity, clearing phone, address, and all other fields | Silent data corruption in QBO on every customer re-sync |
| 3 | `qbo-sync.ts` | `syncInvoiceToQbo()` | Line items sent without `ItemRef` — QBO posts revenue to Uncategorized Income | P&L reports show all revenue in wrong account; job costing is impossible |
| 4 | `qbo-sync.ts` | `syncInvoiceToQbo()` | `Number()` cast on Prisma `Decimal` without rounding — floating-point precision errors (e.g., `123.45678900000001`) | Invoice total mismatches between ServiceOpsIQ and QBO; possible QBO validation rejections |
| 5 | `qbo-sync.ts` | `handleQboPaymentWebhook()` | Handler is not idempotent and performs synchronous processing inline | Duplicate processing on re-delivery; 30s timeout risk once QBO API calls are added |
| 6 | `qbo-client.ts` | `qboRequest()` | `minorversion` not pinned as a named constant — unclear which version is being sent; versions below 75 deprecated Aug 2025 | API calls may fail or behave unexpectedly after Intuit's deprecation deadline |

---

## Recommended Build Order

Dependencies flow strictly downward — each phase produces outputs required by the next.

**Phase 1 — Foundation and Bug Fixes** (no new feature dependencies; fixes live bugs)
- Fix token refresh race condition in `getValidAccessToken()`
- Fix sparse update in `updateCustomer()` — merge-then-POST pattern
- Fix decimal rounding in `syncInvoiceToQbo()`
- Pin `minorversion=75` as a named constant in `qboRequest()`
- Add Prisma models: `QboSyncJob`, `QboAccountMap`, `QboCdcCursor`; add fields: `refreshTokenExpiry`, `qboEstimateId`, `qboItemId`, `qboTimeActivityId`, `qboVendorId`; run migration
- Write `qbo-types.ts` (all entity interfaces — blocks mapper and all sync modules)
- Write `qbo-mapper.ts` (pure transformation, no I/O)
- Write `qbo-queue.ts` (enqueue/claim/done/fail helpers)

**Phase 2 — Client Extensions** (depends on Phase 1 types)
- Extend `qbo-client.ts`: add `batchRequest()`, `queryEntities()`, `cdcRequest()`, `voidInvoice()`, `sendInvoiceEmail()`, `createCreditMemo()`; improve Fault object parsing

**Phase 3 — Account Mapping** (must exist before any financial transaction sync)
- Write `qbo-account-map.ts`; add `GET + POST /api/integrations/qbo/accounts`; build Account Mapping UI

**Phase 4 — Core Outbound Sync** (delivers TS-05, TS-01, TS-06, TS-03, TS-04, D-12)
- Write `qbo-outbound.ts` with all push functions (customer, invoice, estimate, item, employee, vendor, time activity, expense, void, credit memo, send email)
- Harden webhook handler: deduplication table, return 200 immediately, queue-based processing (completes TS-01)
- Add `GET /api/integrations/qbo/health` and Integration Health Dashboard UI (TS-06)
- Chart of Accounts pull: `GET /api/integrations/qbo/accounts` + mapping UI (TS-05)
- Item/Service sync and account assignment (TS-03)
- Estimate/Quote sync with `LinkedTxn` invoice conversion (TS-04)
- Invoice send via QBO email API (D-12)
- Deploy `/api/cron/qbo-flush` at `*/5 * * * *`

**Phase 5 — Inbound Sync and CDC** (depends on Phase 4 outbound working)
- Write `qbo-inbound.ts` (pullPaymentStatus, pullEstimateStatus, pullCustomers, pullItems)
- Write `qbo-cdc.ts` (CDC poll engine with conflict resolution)
- Add `/api/cron/qbo-cdc` at `0 */4 * * *`
- Complete webhook dispatcher `qbo-webhook.ts`, rewire webhook route (TS-02, TS-07)
- Customer inbound sync (D-10)

**Phase 6 — Enterprise Differentiators** (depends on Phases 4-5)
- Employee sync (D-02) + Vendor sync (D-04) — can run in parallel
- Time Activity sync (D-01, depends on D-02)
- Expense / Bill sync (D-03, depends on D-04)
- Class tracking on all transactions (D-06) — requires `GET /preferences` check
- Credit memo creation (D-11)

**Phase 7 — Enterprise Showcase** (depends on Phase 6)
- Purchase Order sync (D-05, requires D-04)
- Location / Department tracking (D-07, layered on D-06 infrastructure)
- QBO Reports API integration — P&L, AR Aging, Balance Sheet embedded in analytics dashboard (D-08)
- Recurring PM invoices via ServiceOpsIQ cron + standard invoice push (D-09)
- Proactive refresh token expiry cron (nightly, warns at 14 days)

---

## Anti-Features (Excluded)

| Feature | Reason Excluded |
|---|---|
| **Bank deposit matching** | QBO's banking module handles this natively with ML matching. Adding it requires direct bank feed API access, Plaid integration, and PCI/compliance surface area. Cost: extreme. Benefit: near zero — QBO already solves it. |
| **Multi-currency support** | ServiceOpsIQ targets US-based industrial service companies exclusively. Multi-currency touches every financial entity, adds exchange rate lookups, and requires a different API workflow. Complexity-to-market-size ratio is deeply unfavorable. |
| **QBO Payroll integration** | Payroll is a regulated compliance domain (IRS, state tax, garnishments). Employee sync (D-02) and Time Activity sync (D-01) feed the data QBO Payroll needs without ServiceOpsIQ touching payroll runs. |
| **QBO Payments processing (taking card payments via API)** | Requires QBO Payments merchant account integration, PCI-DSS compliance scope, card tokenization, and Intuit partner certification. Customer portal payment links already route to QBO's native payment flow — this adds PCI scope with no meaningful UX advantage. |
| **QuickBooks Desktop / Enterprise sync** | ServiceOpsIQ's entire integration is built on QBO REST API v3 (Online only). Desktop requires a separate integration path. Intuit is actively sunsetting Desktop. $50K+ target market runs QBO Online or QBO Advanced. |
| **Real-time (sub-second) sync** | QBO rate limit is 500 req/min per realm; Vercel max function duration is 60 seconds. Real-time sync requires a persistent queue worker (not serverless). 15-minute CDC latency is acceptable for all accounting use cases — the correct architecture is webhook for latency + CDC for correctness. |
| **QBO recurring transaction templates** | No REST API exists for creating or managing QBO recurring templates — this is a UI-only feature in QBO. Implementation is entirely ServiceOpsIQ-side: PM cron generates standard invoices, which are pushed to QBO as regular invoices. No QBO API work needed for this feature. |

---

_Sources: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md — all generated 2026-03-07_
_Competitor benchmarks: ServiceTitan, Jobber, Housecall Pro, FieldPulse, Lexul_
_QBO API references: Intuit Developer Docs, CDC/minorversion/batch/rate limits, Jan 2025 deprecation notice_
