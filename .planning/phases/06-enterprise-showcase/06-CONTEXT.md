# Phase 6: Enterprise Showcase - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the enterprise feature set with purchase order sync, location/department tracking layered on class infrastructure, QBO financial reports embedded in the analytics dashboard, recurring PM invoice automation, and proactive token expiry monitoring.

Requirements: PO-01, DIM-02, DIM-04, RPT-01, RPT-02, DASH-04

</domain>

<decisions>
## Implementation Decisions

### QBO Financial Reports (RPT-01, RPT-02)
- Add a "QBO Financial" tab on the existing Analytics page (not a separate page)
- Full drill-down with charts: summary tables PLUS Recharts visualizations (bar charts for P&L income/expense categories, stacked bars for A/R aging buckets Current/30/60/90+, pie or donut for balance sheet composition)
- Single period only — no period comparison (simplifies both API calls and UI)
- Cash/Accrual toggle switch — let user choose accounting method per report view
- Reuse existing date range picker (7d/30d/90d/custom) from Analytics page
- Class and Location filter dropdowns when those tracking modes are enabled
- Three reports: Profit & Loss, Accounts Receivable Aging, Balance Sheet
- New QBO client functions needed: `runReport(connection, reportName, params)` — generic report runner
- New API endpoint: `GET /api/integrations/qbo/reports?report=ProfitAndLoss&startDate=...&endDate=...&accounting_method=Cash`

### Location/Department Tracking (DIM-02)
- Map **Customer Site** → QBO Location (Department). Each Site becomes a QBO Location entity
- Auto-create QBO Locations on first use — same zero-config pattern as `resolveOrCreateQboClass()`
- New function: `resolveOrCreateQboLocation(connection, orgId, siteId)` — mirrors class tracking pattern exactly
- Cache mappings in a new `QboLocationMap` table (orgId, siteId, qboLocationId, qboLocationName) with @@unique([orgId, siteId])
- When `locationTrackingEnabled=false` on QboConnection: silently omit DepartmentRef — same as class tracking
- Show yellow warning banner on QBO Health dashboard: "Location tracking is disabled in QBO — enable it in QBO Settings to segment your P&L by site"
- Apply DepartmentRef to ALL transaction types: invoices, bills, time activities, POs, credit memos — mirrors ClassRef scope
- Retrofit existing sync functions: syncInvoiceToQbo, syncQuoteToQbo, syncExpenseToQbo, syncTimeEntryToQbo, syncCreditMemoToQbo — add DepartmentRef alongside ClassRef
- Site name used as QBO Location name (e.g., "Acme Corp - Plant 3")

### PM Invoice Auto-Creation (DIM-04)
- Trigger: auto-create QBO invoice when PM work order status changes to COMPLETED
- Opt-in per PM schedule: add `autoInvoice Boolean @default(false)` field to WorkflowDefinition model
- Only schedules with `autoInvoice=true` trigger invoice creation on WO completion
- Line items sourced from PM schedule pricing (fixed price or itemized labor rates from procedure template) — predictable, contract-based billing
- Invoice customer: use the work order's customer (customerId on WO, originally set from schedule by PM cron)
- Auto-sync the created invoice to QBO via existing `syncInvoiceToQbo()` + enqueue pattern
- Integration point: hook into the WO PATCH endpoint — when status transitions to COMPLETED and the WO's schedule has `autoInvoice=true`, create Invoice + enqueue QBO sync
- Include ClassRef (from WO orderType) and DepartmentRef (from WO site) on the auto-created QBO invoice

### Purchase Order Sync (PO-01)
- New `PurchaseOrder` Prisma model — minimal header + line items:
  - Header: id, orgId, poNumber, vendorId, status (DRAFT/SENT/RECEIVED/CLOSED/CANCELED), expectedDate, notes, totalAmount, qboPurchaseOrderId, qboSyncedAt, createdAt, updatedAt
  - Lines: `PurchaseOrderLine` model — id, purchaseOrderId, materialId (optional), description, quantity, unitPrice, amount
- Vendor FK: links to existing Vendor model from Phase 5
- Material FK: optional link on lines — allows PO for materials not in catalog
- Sync trigger: auto-enqueue `purchaseOrder:push` job when PO status changes to SENT (drafts stay local)
- New QBO client functions: `createPurchaseOrder(connection, data)`, `getPurchaseOrder(connection, id)`, `updatePurchaseOrder(connection, id, data)`
- New mapper: `toQboPurchaseOrder(po, lines, vendorQboId, accountMapping, classRef, departmentRef)` — pure function
- New sync function: `syncPurchaseOrderToQbo(orgId, poId)` — cascade vendor sync if needed, apply ClassRef + DepartmentRef
- Apply both ClassRef and DepartmentRef to PO (uses WO's orderType for class if linked, or a default; uses vendor's location or org default for department)
- Include in flush dispatcher: `purchaseOrder:push` case
- No PO UI in Phase 6 scope — API and sync only (UI can be added in a future milestone)

### Token Expiry Monitoring (DASH-04)
- New nightly cron: `GET /api/cron/qbo-token-check` — runs daily at 2 AM UTC
- Add to vercel.json: `0 2 * * *` (4th cron job)
- Logic: query all active QboConnections, check `refreshTokenExpiry` — if within 14 days, attempt proactive refresh via `refreshAccessToken()`
- On successful proactive refresh: update tokens, log to QboSyncLog (type: token_refresh, status: success)
- On `invalid_grant` failure: mark connection `isActive=false`, send admin email alert via Resend
- Email alert: includes company name, expiry date, and a direct reconnect link (`/settings/integrations?reconnect=true`)
- Dashboard alert: persistent red banner on QBO Health page when connection is inactive due to token failure: "QBO connection lost — tokens expired. Click to reconnect."
- Also flag on main integrations settings page with red dot indicator

### Claude's Discretion
- Exact Recharts chart types and color schemes for financial reports (follow existing charts.css patterns)
- QBO Reports API response parsing (varies by report type — Claude handles the normalization)
- PurchaseOrder model field details beyond the minimum specified
- QboLocationMap index strategy
- Whether to batch-retrofit DepartmentRef into existing sync functions or add incrementally
- Token check cron error handling and retry logic
- Toast notification wording for PM auto-invoice creation
- Loading/empty states for QBO Financial reports tab
- Whether PO needs a default class when not linked to a WO

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveOrCreateQboClass()` in qbo-sync.ts — exact pattern to clone for `resolveOrCreateQboLocation()`
- `QboClassMap` Prisma model — clone structure for `QboLocationMap`
- `fetchAndCachePreferences()` — already caches `locationTrackingEnabled` on QboConnection
- `QboPurchaseOrder`, `QboLocation`, `QboPreferences` types already defined in qbo-types.ts
- Analytics page (`src/app/(app)/analytics/page.tsx`) — has date range picker, Recharts charts, tab structure to extend
- `charts.css` — existing chart styling patterns (Recharts containers, responsive breakpoints)
- `enqueue()` + flush dispatcher — add `purchaseOrder:push` case
- Vendor model with `qboVendorId` — ready for PO VendorRef
- PM cron (`src/app/api/cron/generate-pms/route.ts`) — understand WO generation flow for DIM-04 hook
- `sendEmail()` from `src/lib/email.ts` — for token expiry admin alerts
- Resend integration — already configured, used for transactional emails
- `vercel.json` — currently 3 cron entries, add token-check as 4th

### Established Patterns
- Sync function: `async function syncXToQbo(orgId, entityId): Promise<{success, error?}>`
- Mapper: pure function, no I/O, takes Prisma types → returns QBO API payload
- Cascade sync: check dependencies before main entity (vendor before PO, customer before invoice)
- Class/Location tracking: resolve → null if disabled, QboRef if enabled (never blocks sync)
- Cron security: Bearer token via CRON_SECRET, same pattern for all cron routes
- All QBO syncs log to QboSyncLog for dashboard visibility

### Integration Points
- Analytics page: add "QBO Financial" tab with conditional rendering (only when QBO connected)
- QBO Health dashboard: add location tracking warning banner (alongside existing class tracking banner)
- WO PATCH endpoint (`src/app/api/work-orders/[id]/route.ts`): hook PM auto-invoice on COMPLETED transition
- WorkflowDefinition model: add `autoInvoice Boolean @default(false)` field
- Flush dispatcher: add `purchaseOrder:push` dispatch case
- Existing sync functions: retrofit with DepartmentRef parameter (syncInvoiceToQbo, syncQuoteToQbo, syncExpenseToQbo, syncTimeEntryToQbo, syncCreditMemoToQbo)
- vercel.json: add 4th cron entry for token check
- Integrations settings page: red dot indicator when connection inactive

</code_context>

<specifics>
## Specific Ideas

- Location tracking follows the class tracking pattern exactly — `resolveOrCreateQboLocation()` mirrors `resolveOrCreateQboClass()`. This keeps the codebase consistent and the mental model simple.
- PM auto-invoicing is opt-in because GPS does both customer-facing PMs (billable) and internal maintenance (not billable). The admin controls which schedules auto-invoice.
- PO sync is API-only in Phase 6 — no UI pages for creating/managing POs. This keeps the phase focused on the QBO sync layer. A PO management UI can be added in a future milestone.
- Financial reports use the QBO Reports API (different from entity CRUD APIs) — returns structured row/column data that needs normalization before rendering in Recharts.
- Token monitoring is the "insurance policy" for the entire integration — a broken token silently kills ALL sync. Proactive monitoring prevents the 100-day refresh token expiry cliff.

</specifics>

<deferred>
## Deferred Ideas

- PO management UI (create, edit, list, detail pages) — future milestone
- Period-over-period comparison for QBO financial reports — future enhancement
- Custom report builder (user defines which QBO reports to pull) — future milestone
- PO → Receipt → Bill three-way matching UI in ServiceOps — future milestone (QBO handles this natively)
- Location hierarchy (parent/child locations for regional rollup) — future enhancement
- PM invoice email delivery (auto-send via QBO after creation) — could be added alongside DIM-04

</deferred>

---

*Phase: 06-enterprise-showcase*
*Context gathered: 2026-03-10*
