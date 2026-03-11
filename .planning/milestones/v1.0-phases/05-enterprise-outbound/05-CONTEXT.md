# Phase 5: Enterprise Outbound - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the enterprise differentiators: employee and vendor sync, time activity and expense/bill sync, class tracking on all transactions, credit memo creation, and QBO preferences check. These are the features that separate $50K+ positioning from SMB tools.

Requirements: QUOT-03, VEND-01, TIME-01, TIME-02, EXP-01, DIM-01, DIM-03

</domain>

<decisions>
## Implementation Decisions

### Vendor Data Model (VEND-01)
- Create a new standalone `Vendor` Prisma model (not mapped from Material.manufacturer)
- Add `vendorId` FK to Material model for linking materials to their vendor/supplier
- When a Vendor is created, auto-link Materials with matching manufacturer name (set vendorId FK)
- Vendor fields: Claude's discretion on exact field set — must cover QBO Vendor sync needs (name, email, phone, companyName, address, tax1099, vendorType, isActive, qboVendorId)
- 1099 default: Claude's discretion — base on common GPS vendor patterns (subcontractors typically need 1099)
- Apply existing `resolveOrCreateQboEntity()` collision handling pattern for Vendor DisplayName

### Employee Mapping (TIME-01)
- Map `User` model directly to QBO Employees — add `qboEmployeeId String?` to User model
- No separate Employee model needed — User already has name and email
- Sync Users with `role=TECH` to QBO as Employees (admins/dispatchers don't clock time)
- Auto-sync on first time entry: when a tech's TimeEntry syncs and they lack `qboEmployeeId`, auto-create QBO Employee first (cascade sync pattern)
- DisplayName: use `User.name` with email prefix fallback if name is null
- Apply existing `resolveOrCreateQboEntity()` collision handling for Employee DisplayName

### Time Activity Sync (TIME-02)
- Push `TimeEntry` records to QBO as `TimeActivity` entities
- Link to QBO Employee (via user's qboEmployeeId), QBO Customer (via workOrder.customer.qboCustomerId), and QBO Service Item (via labor rate's qboItemId)
- `qboTimeActivityId` field already exists on TimeEntry model (added Phase 1)
- Billable/non-billable classification: Claude's discretion — determine from context (e.g., warranty work = non-billable)
- Auto-sync when TimeEntry status changes to STOPPED (completed time entries only)
- Cascade: sync employee + customer + labor rate item before syncing time activity

### Expense/Bill Sync (EXP-01)
- Source: `StockMovement` with type=PURCHASE — this is the actual cost event (money leaving company)
- Bill vs Purchase: if the StockMovement's Material has a linked `vendorId` → QBO Bill; if no vendor → QBO Purchase
- Auto-enqueue bill:push job when StockMovement PURCHASE is created (consistent with existing auto-sync pattern)
- Account mapping: use existing `job_cost_expense` category for material purchases, `subcontractor_expense` for subcontractor bills — existing 5 categories are sufficient
- Add `qboBillId String?` or `qboPurchaseId String?` to StockMovement model for tracking sync state

### Credit Memo (QUOT-03)
- Claude's discretion on trigger mechanism — choose between new invoice status (CREDITED) or manual "Issue Credit" action based on field service credit workflows
- Create QBO `CreditMemo` with `LinkedTxn` referencing the original QBO invoice
- Credit amount comes from the source invoice
- Enqueue via existing queue pattern: creditMemo:push

### Class Tracking (DIM-01)
- Map `WorkOrder.orderType` (WORK_ORDER, SERVICE_ORDER, PROJECT, MAINTENANCE) to QBO Classes
- Auto-create QBO Classes on first use — when syncing a transaction and the QBO Class for that orderType doesn't exist, create it in QBO automatically
- Apply `ClassRef` to all synced transactions: invoices, bills, time activities
- Store class mapping: Claude's discretion on storage approach (could be a simple in-memory map per orderType, or a QboClassMap table)
- Need to retrofit existing sync functions (syncInvoiceToQbo, etc.) to include ClassRef

### Preferences Check (DIM-03)
- Check QBO Preferences on connect, cache Class/Location tracking flags on `QboConnection`
- Add fields to QboConnection: `classTrackingEnabled Boolean?`, `locationTrackingEnabled Boolean?`, `preferencesLastCheckedAt DateTime?`
- Refresh daily via existing CDC cron (add preferences fetch to the 4-hour cron cycle)
- When Class tracking is disabled: silently omit ClassRef from transactions (don't block sync)
- Show a yellow info banner on QBO Health dashboard when Class tracking is disabled: "Class tracking is disabled in QBO — enable it in QBO Settings to segment your P&L by work type"

### Claude's Discretion
- Exact Vendor model fields (beyond the minimum: name, qboVendorId, orgId, isActive)
- 1099 default behavior (default false vs auto-true for subcontractors)
- Billable/non-billable classification logic for time entries
- Credit memo trigger mechanism (status change vs manual action)
- Class mapping storage approach (in-memory vs DB table)
- New QBO client functions needed (createEmployee, createVendor, createTimeActivity, createBill, createPurchase, createCreditMemo, getPreferences)
- Mapper function design for new entity types
- Test coverage scope for new sync functions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveOrCreateQboEntity()` in qbo-sync.ts — collision handling for all named entities (already used by Customer, Material, LaborRate)
- `enqueue()` in qbo-queue.ts — queue any sync job with entityType:action pattern
- `toQboItem()` in qbo-mapper.ts — example of pure mapper function pattern to follow
- `roundQboAmount()` in qbo-mapper.ts — monetary value rounding for QBO
- All QBO types already defined in qbo-types.ts: QboEmployee, QboVendor, QboTimeActivity, QboBill, QboPurchase, QboCreditMemo, QboClass, QboPreferences
- Flush dispatcher in qbo-flush/route.ts — switch on `${entityType}:${action}` pattern, needs extension for new entity types

### Established Patterns
- Sync function signature: `async function syncXToQbo(orgId: string, entityId: string): Promise<{success: boolean; error?: string}>`
- Cascade sync: check dependencies (customer, items) before main entity sync — auto-sync missing dependencies
- Mapper functions: pure, no I/O, take ServiceOps Prisma types → return QBO API payload shapes
- QBO client functions: `createX(connection, payload)`, `getX(connection, id)`, `updateX(connection, id, payload)`
- All queries include `orgId` for multi-tenancy
- Error handling: try/catch → QboSyncLog entry → return `{ success, error }`

### Integration Points
- Flush dispatcher: add cases for `vendor:push`, `employee:push`, `timeActivity:push`, `bill:push`, `purchase:push`, `creditMemo:push`
- Prisma schema: new Vendor model, add qboEmployeeId to User, add qboBillId/qboPurchaseId to StockMovement, add vendorId to Material, add class/location flags to QboConnection
- QBO client: add createEmployee, createVendor, createTimeActivity, createBill, createPurchase, createCreditMemo, getPreferences functions
- QBO mapper: add toQboVendor, toQboEmployee, toQboTimeActivity, toQboBill, toQboPurchase, toQboCreditMemo pure functions
- Account mapping gate: expense/bill syncs use existing `getAccountMapping()` with `job_cost_expense` category
- Existing sync functions (syncInvoiceToQbo, etc.): retrofit to include ClassRef when class tracking is enabled

</code_context>

<specifics>
## Specific Ideas

- Vendor model should support both material suppliers and subcontractor companies (vendorType discriminator)
- Employee sync is tightly coupled to time activity sync — a tech should never need to manually configure their QBO employee record
- StockMovement PURCHASE is the correct expense trigger because it represents actual cash outflow — TaskMaterialUsage represents consumption, not cost events
- Class tracking should be zero-config: auto-create classes from orderType enum values, silently skip when QBO has it disabled

</specifics>

<deferred>
## Deferred Ideas

- Location/Department tracking (DIM-02) — Phase 6, builds on class tracking infrastructure
- Purchase order sync (PO-01) — Phase 6, leverages the Vendor model created here
- Vendor management UI — not in scope for Phase 5 (backend sync only); could be added to a future milestone
- Advanced expense categories beyond the existing 5 — defer until user demonstrates need

</deferred>

---

*Phase: 05-enterprise-outbound*
*Context gathered: 2026-03-09*
