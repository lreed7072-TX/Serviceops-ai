# Phase 6: Enterprise Showcase - Research

**Researched:** 2026-03-10

---

## PO-01: Purchase Order Sync

### Existing Type — QboPurchaseOrder in qbo-types.ts (lines 366-386)
The type is fully defined and matches QBO minorversion=75:
```typescript
export type QboPurchaseOrder = {
  Id: string;
  SyncToken: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  VendorRef: QboRef;         // Required — must be synced vendor
  APAccountRef?: QboRef;
  ShipTo?: QboRef;
  ShipAddr?: QboAddress;
  DepartmentRef?: QboRef;    // For location tracking (Phase 6 DIM-02)
  ClassRef?: QboRef;         // For class tracking
  POStatus?: string;          // "Open" | "Closed"
  Line: QboLine[];
  TotalAmt?: number;
  Memo?: string;
};
```
No `QboPurchaseOrder` CRUD client functions exist yet (createPurchaseOrder, getPurchaseOrder, updatePurchaseOrder are missing from qbo-client.ts).

### QBO Client Pattern to Follow
From qbo-client.ts, the pattern for a new entity is:
```typescript
export async function createPurchaseOrder(connection: QboConnection, data: Partial<QboPurchaseOrder>): Promise<QboPurchaseOrder> {
  const result = (await qboRequest(connection, "POST", "purchaseorder", data as Record<string, unknown>)) as { PurchaseOrder: QboPurchaseOrder };
  return result.PurchaseOrder;
}
export async function getPurchaseOrder(connection: QboConnection, id: string): Promise<QboPurchaseOrder> {
  const result = (await qboRequest(connection, "GET", `purchaseorder/${id}`)) as { PurchaseOrder: QboPurchaseOrder };
  return result.PurchaseOrder;
}
// updatePurchaseOrder uses fetch-merge-POST pattern (same as updateVendor, updateEmployee)
```
The QBO REST endpoint for POs is `/purchaseorder` (not `/purchase-order`).

### Vendor Model — Already Exists (prisma/schema.prisma lines 1119-1143)
```prisma
model Vendor {
  id          String     @id @default(uuid()) @db.Uuid
  orgId       String     @db.Uuid
  name        String
  companyName String?
  email       String?
  phone       String?
  address     String?
  city        String?
  state       String?
  postalCode  String?
  vendorType  VendorType @default(SUPPLIER)
  tax1099     Boolean    @default(false)
  isActive    Boolean    @default(true)
  notes       String?    @db.Text
  qboVendorId String?    // FK to QBO — used for cascade sync
  qboSyncedAt DateTime?
}
```
Vendor has `qboVendorId` — the cascade pattern in `syncVendorToQbo` can be called from `syncPurchaseOrderToQbo` exactly as it is called in `syncExpenseToQbo`.

### New Prisma Models Required
Two new models must be added:
```prisma
model PurchaseOrder {
  id                 String              @id @default(uuid()) @db.Uuid
  orgId              String              @db.Uuid
  poNumber           String
  vendorId           String              @db.Uuid
  status             PurchaseOrderStatus @default(DRAFT)
  expectedDate       DateTime?
  notes              String?             @db.Text
  totalAmount        Decimal?            @db.Decimal(10, 2)
  qboPurchaseOrderId String?
  qboSyncedAt        DateTime?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  org    Org                 @relation(fields: [orgId], references: [id])
  vendor Vendor              @relation(fields: [vendorId], references: [id])
  lines  PurchaseOrderLine[]

  @@unique([orgId, poNumber])
  @@index([orgId])
  @@index([orgId, vendorId])
  @@index([orgId, status])
}

model PurchaseOrderLine {
  id              String        @id @default(uuid()) @db.Uuid
  purchaseOrderId String        @db.Uuid
  materialId      String?       @db.Uuid  // Optional link to material catalog
  description     String
  quantity        Float
  unitPrice       Decimal       @db.Decimal(10, 2)
  amount          Decimal       @db.Decimal(10, 2)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  material      Material?     @relation(fields: [materialId], references: [id])
}

enum PurchaseOrderStatus {
  DRAFT
  SENT
  RECEIVED
  CLOSED
  CANCELED
}
```

### Sync Trigger Logic
Sync is triggered when PO status changes to SENT (not DRAFT). This mirrors the invoice CANCELED → void pattern from Phase 4. The PATCH endpoint for PO (future) would enqueue `purchaseOrder:push` on SENT transition.

### Mapper Function Pattern
Following `toQboBill` and `toQboPurchase` patterns from qbo-mapper.ts:
```typescript
export function toQboPurchaseOrder(
  po: { poNumber: string; notes?: string | null; expectedDate?: Date | null },
  lines: Array<{ description: string; quantity: number; unitPrice: unknown; amount: unknown; material?: { name: string } | null }>,
  qboVendorId: string,
  options?: { classRef?: QboRef; departmentRef?: QboRef }
): Partial<QboPurchaseOrder>
```
Uses `roundQboAmount()` on unitPrice and amount. Lines use `ItemBasedExpenseLineDetail` DetailType.

### Flush Dispatcher
Add to the `switch` in qbo-flush/route.ts:
```typescript
case "purchaseOrder:push": {
  const poResult = await syncPurchaseOrderToQbo(job.orgId, job.entityId);
  if (!poResult.success) throw new Error(poResult.error || "PO sync failed");
  break;
}
```

### Sync Function Signature
```typescript
export async function syncPurchaseOrderToQbo(
  orgId: string,
  poId: string
): Promise<{ success: boolean; qboPurchaseOrderId?: string; error?: string }>
```
Internal flow: get connection → get PO with lines and vendor → cascade `syncVendorToQbo` if no `qboVendorId` → resolve ClassRef (`resolveOrCreateQboClass`) → resolve DepartmentRef (`resolveOrCreateQboLocation`) → map → createPurchaseOrder → update PO record → log.

---

## DIM-02: Location/Department Tracking

### The Pattern to Clone — resolveOrCreateQboClass (qbo-sync.ts lines ~1855-1906)
The exact function to mirror:
```typescript
export async function resolveOrCreateQboClass(
  connection: QboConnection,
  orgId: string,
  orderType: string
): Promise<QboRef | null> {
  try {
    if (!connection.classTrackingEnabled) return null;  // Silently omit if disabled

    // Check cache first
    const existing = await prisma.qboClassMap.findUnique({
      where: { orgId_orderType: { orgId, orderType } },
    });
    if (existing) return { value: existing.qboClassId, name: existing.qboClassName };

    // Auto-create in QBO
    const className = classNameMap[orderType] || orderType;
    const qboClass = await createClass(connection, { Name: className });

    // Cache the mapping
    await prisma.qboClassMap.upsert({ ... });
    return { value: qboClass.Id, name: className };
  } catch (err) {
    console.error(...);
    return null;  // NEVER block a sync
  }
}
```

### New Function: resolveOrCreateQboLocation
Mirrors above exactly, but:
- Checks `connection.locationTrackingEnabled` (already on QboConnection model — line 1764)
- Uses `QboLocationMap` table instead of `QboClassMap`
- Key is `siteId` (not `orderType`)
- Site name = QBO Location name (e.g., "Acme Corp - Plant 3")
- Uses `createLocation` client function (new, mirrors `createClass`)
- Returns `QboRef | null`

### New QBO Client Functions Required
QBO Location entity is called `Department` in the QBO API:
```typescript
export async function createLocation(connection: QboConnection, data: { Name: string }): Promise<QboLocation> {
  const result = (await qboRequest(connection, "POST", "department", data as Record<string, unknown>)) as { Department: QboLocation };
  return result.Department;
}
export async function queryLocations(connection: QboConnection): Promise<QboLocation[]> {
  return queryEntities<QboLocation>(connection, "SELECT * FROM Department WHERE Active = true", "Department");
}
```
Note: QBO type name is `Department` but our semantic name is `Location` (matches DepartmentRef). The QboLocation type is already in qbo-types.ts (lines 446-455).

### New Prisma Model Required
```prisma
model QboLocationMap {
  id               String   @id @default(uuid()) @db.Uuid
  orgId            String   @db.Uuid
  siteId           String   @db.Uuid
  qboLocationId    String
  qboLocationName  String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  org              Org      @relation(fields: [orgId], references: [id])
  @@unique([orgId, siteId])
  @@index([orgId])
}
```

### QboConnection Fields Already Present
From schema.prisma line 1764:
```prisma
locationTrackingEnabled Boolean?
```
And `fetchAndCachePreferences()` already sets it:
```typescript
const locationTrackingEnabled = prefs.AccountingInfoPrefs?.TrackDepartments === true;
```
No schema change needed for QboConnection.

### Where to Apply DepartmentRef (Retrofit Existing Functions)
All of these need `DepartmentRef` added alongside the existing `ClassRef` pattern. The `siteId` must be fetched from the work order/invoice context:

1. **syncInvoiceToQbo** — invoice has `siteId` field (Invoice model line 1373). Resolve via `resolveOrCreateQboLocation(connection, orgId, invoice.siteId)`.
2. **syncQuoteToQbo** — Quote has `siteId` field (Quote model line 1230). Same pattern.
3. **syncExpenseToQbo** — StockMovement does not have siteId. Must trace: StockMovement → material → taskMaterialUsage → taskInstance → workOrder → siteId. Complex path; may need WO join.
4. **syncTimeEntryToQbo** — TimeEntry has `workOrder` relation with `siteId`. Access via `timeEntry.workOrder.siteId`.
5. **syncCreditMemoToQbo** — Invoice has `siteId`. Same as invoice.
6. **syncPurchaseOrderToQbo** (new) — PO has no direct siteId; use vendor's location default or org default (per context decisions).

### createInvoice in qbo-client.ts
The `createInvoice` function needs a `departmentRef` parameter added alongside `classRef`. Currently:
```typescript
classRef?: { value: string; name?: string }
```
Add:
```typescript
departmentRef?: { value: string; name?: string }
```
And set `qboInvoice.DepartmentRef = { value: ..., name: ... }` in the body.

### Warning Banner Pattern (QBO Health Page)
Existing class tracking banner at qbo-health/page.tsx lines 312-318:
```tsx
{conn.classTrackingEnabled === false && (
  <div className="qbo-health__warning-banner">
    <AlertTriangle size={18} />
    <div>
      <strong>Class tracking is disabled in QuickBooks</strong>
      <p>Enable it under Account and Settings > Advanced > Categories...</p>
    </div>
  </div>
)}
```
Add a sibling banner for location tracking:
```tsx
{conn.locationTrackingEnabled === false && (
  <div className="qbo-health__warning-banner">
    <AlertTriangle size={18} />
    <div>
      <strong>Location tracking is disabled in QuickBooks</strong>
      <p>Enable it under Account and Settings > Advanced > Categories to segment your P&L by site.</p>
    </div>
  </div>
)}
```

---

## DIM-04: Recurring PM Invoices

### PM Cron Flow (generate-pms/route.ts)
The cron:
1. Queries `WorkflowDefinition` where `status=ACTIVE`, `autoGenerateWorkOrders=true`, `nextScheduledDate <= now`
2. Creates `WorkOrder` with `sourceWorkflowId = schedule.id`, `customerId`, `siteId` from schedule
3. Creates `WorkPackage` and `TaskInstance` records
4. Updates `lastGeneratedWorkOrderId`, `nextScheduledDate`, `executionCount`

**Key fields available on schedule for DIM-04:**
- `schedule.customerId` — used as WO customer → same for invoice customer
- `schedule.siteId` — used as WO site → same for invoice DepartmentRef
- `schedule.orgId`
- `schedule.id` — the scheduleId that will have `autoInvoice` flag

### WorkflowDefinition Schema Change Required
Add `autoInvoice` field:
```prisma
autoInvoice Boolean @default(false)  // After autoGenerateWorkOrders field
autoInvoiceAmount Decimal? @db.Decimal(10,2)  // Optional fixed price for the invoice
```
The context doc specifies "fixed price or itemized labor rates from procedure template". For simplicity, a fixed `autoInvoiceAmount` covers the primary case. If null, use procedure steps to build line items.

### Invoice Creation Pattern
From Invoice model (prisma/schema.prisma lines 1369-1407):
```prisma
model Invoice {
  id            String        @id
  orgId         String
  customerId    String
  siteId        String?
  workOrderId   String?
  invoiceNumber String
  // ... status, dueDate, total, etc.
  lineItems     InvoiceLineItem[]
}
```
The invoice creation must:
1. Generate next invoice number (same pattern as WO number in cron)
2. Create `Invoice` record with `customerId`, `siteId`, `workOrderId = workOrder.id`
3. Create `InvoiceLineItem` for the PM service
4. Enqueue `invoice:push` to QBO via `enqueue()`

### WO PATCH Endpoint Hook
Current PATCH handler (work-orders/[id]/route.ts lines 176-248) does NOT yet handle the auto-invoice trigger. The hook needs to be added after the `prisma.workOrder.update()` call:

```typescript
// After workOrder update...
if (status === "COMPLETED" && existing.status !== "COMPLETED") {
  // Check if this WO came from a PM schedule with autoInvoice=true
  const updatedWO = await prisma.workOrder.findUnique({
    where: { id },
    select: { sourceWorkflowId: true, customerId: true, siteId: true, orderType: true }
  });
  if (updatedWO?.sourceWorkflowId) {
    const schedule = await prisma.workflowDefinition.findUnique({
      where: { id: updatedWO.sourceWorkflowId },
      select: { autoInvoice: true, autoInvoiceAmount: true, name: true }
    });
    if (schedule?.autoInvoice) {
      await createPmAutoInvoice(auth.orgId, id, updatedWO, schedule);
    }
  }
}
```

Note: `existing` in the PATCH handler only has `id` and `status` (line 191 select clause). Need to re-fetch or expand the existing select to get `sourceWorkflowId`.

### enqueue Import
The WO PATCH route needs to import `enqueue` from qbo-queue (same as done in invoice PATCH for PAY-02 from Phase 4):
```typescript
import { enqueue } from "@/lib/qbo/qbo-queue";
```

---

## RPT-01 & RPT-02: QBO Reports

### Analytics Page Structure (analytics/page.tsx)
The page is a single `"use client"` component with:
- `DateRange` type: `"7d" | "30d" | "90d" | "custom"`
- `getDateRange()` helper returning `{ start, end }` ISO date strings
- `useEffect` fetching 4 parallel API calls on dateRange/startDate/endDate change
- Six Recharts chart components imported individually
- CSS from `@/components/charts/charts.css`

**No tab structure exists yet** — the analytics page is a flat dashboard. Adding a "QBO Financial" tab requires adding tab state management (similar to the pattern used on QBO Health for filter tabs).

### Tab Implementation Pattern
The analytics page needs a new tab system:
```tsx
type AnalyticsTab = "operations" | "qbo_financial";
const [activeTab, setActiveTab] = useState<AnalyticsTab>("operations");
```
The existing content becomes the "Operations" tab. The "QBO Financial" tab renders only when `activeTab === "qbo_financial"`. The QBO Financial tab should conditionally render only when QBO is connected (check via API or a connection state).

### New API Endpoint Required
`GET /api/integrations/qbo/reports`
Query params: `report=ProfitAndLoss|ARAgingDetail|BalanceSheet`, `startDate`, `endDate`, `accounting_method=Cash|Accrual`, `class=`, `location=`

QBO Reports API is different from entity CRUD — it uses a different URL path:
```
GET /v3/company/{realmId}/reports/{reportName}?start_date=...&end_date=...&accounting_method=...
```
No existing `runReport()` function exists in qbo-client.ts. Need to add:
```typescript
export async function runReport(
  connection: QboConnection,
  reportName: string,
  params: Record<string, string>
): Promise<QboReportResponse>
```
QBO returns structured JSON with `Header`, `Columns`, and `Rows` arrays. The API endpoint must normalize this into chart-ready data.

### QBO Report Response Shape
QBO report responses have this shape:
```json
{
  "Header": { "ReportName": "ProfitAndLoss", "StartPeriod": "...", "EndPeriod": "..." },
  "Columns": { "Column": [{ "ColTitle": "...", "ColType": "..." }] },
  "Rows": {
    "Row": [
      { "type": "Section", "Header": { "ColData": [{ "value": "Income" }] },
        "Rows": { "Row": [{ "type": "Data", "ColData": [{ "value": "Services" }, { "value": "5000" }] }] },
        "Summary": { "ColData": [{ "value": "Total Income" }, { "value": "5000" }] }
      }
    ]
  }
}
```
This needs normalization into `{ categories: string[], values: number[] }` per section for Recharts BarChart.

### New Type Required
```typescript
export type QboReportResponse = {
  Header: { ReportName: string; StartPeriod?: string; EndPeriod?: string; Currency?: string };
  Columns: { Column: Array<{ ColTitle: string; ColType: string }> };
  Rows: { Row: Array<QboReportRow> };
};
export type QboReportRow = {
  type: "Section" | "Data" | "GrandTotal";
  Header?: { ColData: Array<{ value: string }> };
  Rows?: { Row: QboReportRow[] };
  Summary?: { ColData: Array<{ value: string }> };
  ColData?: Array<{ value: string; id?: string }>;
};
```

### Three Reports and Their Chart Types
1. **P&L (ProfitAndLoss)** — Bar chart: income categories vs expense categories. Two `BarChart` components side by side or stacked.
2. **A/R Aging (AgedReceivableDetail)** — Stacked bar chart: aging buckets (Current, 1-30, 31-60, 61-90, 91+). One `BarChart` per customer or aggregated buckets.
3. **Balance Sheet (BalanceSheet)** — Pie/Donut chart: asset/liability/equity composition.

### Chart Colors (from charts.css / existing patterns)
Existing charts use: `#f97316` (orange/accent), `#3b82f6` (blue), `#10b981` (green), `#f59e0b` (amber), `#ef4444` (red). The QBO Financial charts should follow the same palette.

---

## DASH-04: Token Expiry Monitoring

### refreshAccessToken Function (qbo-client.ts lines 93-130)
The function exists and works. It throws on non-OK response including `invalid_grant`. The error text from QBO on expired refresh token is typically `{"error":"invalid_grant"}`.

### New Cron Route Pattern
From qbo-flush/route.ts and generate-pms/route.ts, the security pattern:
```typescript
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... cron logic
}
```

### QboConnection Fields for Token Check
From schema.prisma (lines 1749-1768):
```prisma
model QboConnection {
  refreshTokenExpiry DateTime?   // Already exists — the 100-day expiry date
  isActive          Boolean     @default(true)
  // ...
}
```
The `refreshTokenExpiry` field already exists. The cron queries all active connections and checks it.

### Cron Logic Outline
```typescript
const connections = await prisma.qboConnection.findMany({
  where: { isActive: true },
  include: { org: { select: { name: true, id: true } } }
});

for (const conn of connections) {
  const daysUntilExpiry = conn.refreshTokenExpiry
    ? Math.floor((conn.refreshTokenExpiry.getTime() - Date.now()) / 86400000)
    : null;

  if (daysUntilExpiry !== null && daysUntilExpiry <= 14) {
    try {
      // Proactive refresh
      const tokens = await refreshAccessToken(conn);
      await prisma.qboConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
          refreshTokenExpiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
        }
      });
      await prisma.qboSyncLog.create({ /* type: token_refresh, status: success */ });
    } catch (err) {
      const isInvalidGrant = String(err).includes("invalid_grant");
      if (isInvalidGrant) {
        // Mark inactive + send admin email
        await prisma.qboConnection.update({ where: { id: conn.id }, data: { isActive: false } });
        await sendAdminTokenExpiredEmail(conn);
      }
      await prisma.qboSyncLog.create({ /* status: failed */ });
    }
  }
}
```

### sendEmail Pattern (email.ts)
```typescript
export async function sendEmail(options: SendEmailOptions): Promise<void>
// SendEmailOptions: { to, subject, html, fromName?, fromEmail?, replyTo? }
```
For token expiry alert, the `to` should be the org admin's email (query `User` where `orgId=conn.orgId AND role='ADMIN'`).

Email body should include:
- Company name (`conn.companyName`)
- Expiry date (`conn.refreshTokenExpiry`)
- Reconnect link: `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?reconnect=true`

### vercel.json Addition
Current vercel.json has 3 crons. Add 4th:
```json
{
  "path": "/api/cron/qbo-token-check",
  "schedule": "0 2 * * *"
}
```

### Dashboard Alert (QBO Health Page)
The `ConnectionInfo` type already has `refreshTokenExpiresAt: string | null` (qbo-health/page.tsx line 31). The health API already returns it. A persistent red banner when `isActive=false` due to token failure:
```tsx
{!health.connected && (
  <div className="qbo-health__error-banner">
    <XCircle size={18} />
    QBO connection lost — tokens expired.{' '}
    <Link href="/settings/integrations?reconnect=true">Click to reconnect.</Link>
  </div>
)}
```

### Integrations Settings Page Red Dot
The integrations settings page already shows "View Sync Health" when connected (Phase 3). Add a red dot indicator when `isActive=false`:
```tsx
{!qboConnected && qboConnectionExists && (
  <span className="integration-status-dot integration-status-dot--error" />
)}
```

---

## Cross-Cutting Patterns

### Sync Function Signature (All Phase 6 sync functions)
```typescript
async function syncXToQbo(orgId: string, entityId: string): Promise<{ success: boolean; error?: string }>
```
Always: get connection → early return if null → try/catch → log success/failure to QboSyncLog.

### Mapper Pattern (qbo-mapper.ts)
- Pure functions — no `async`, no `prisma`, no `fetch`
- Always accept `existingQbo?` for merge pattern
- Always call `roundQboAmount()` on monetary values
- Return `Partial<QboXxx>`

### ClassRef + DepartmentRef Application Pattern
Both resolve functions return `QboRef | null`. The `null` case silently omits the ref — never blocks sync:
```typescript
const classRef = await resolveOrCreateQboClass(connection, orgId, orderType) ?? undefined;
const departmentRef = await resolveOrCreateQboLocation(connection, orgId, siteId) ?? undefined;
// Then pass to mapper/client: { classRef, departmentRef }
```

### QboSyncLog Pattern
Every sync function logs both success and failure to `prisma.qboSyncLog.create()`:
```typescript
await prisma.qboSyncLog.create({
  data: {
    orgId,
    connectionId: connection.id,
    entityType: "purchaseOrder",  // or "location", "tokenRefresh", etc.
    entityId: poId,
    qboEntityId: result.Id,
    action: "push",
    status: "success",  // or "failed"
    errorMessage: undefined,  // or error string
  }
});
```

### enqueue Pattern (qbo-queue.ts)
```typescript
await enqueue(orgId, connection.id, "purchaseOrder", poId, "push", 5);
```
Priority 5 = normal. Priority 1 = high (used for manual triggers and void ops).

### Dedup Guard Pattern (from CDC cron)
Before enqueuing for PO, check for existing pending job:
```typescript
const existing = await prisma.qboSyncJob.findFirst({
  where: { orgId, entityType: "purchaseOrder", entityId: poId, status: { in: ["pending", "claimed"] } }
});
if (!existing) {
  await enqueue(orgId, connection.id, "purchaseOrder", poId, "push");
}
```

### Testing Pattern
Existing tests are in `src/__tests__/lib/qbo/`. Phase 5 created:
- `mapper-phase5.test.ts` (15 tests — pure mapper functions)
- `sync-vendor-employee.test.ts` (8 tests)
- `sync-time-expense-credit.test.ts` (12 tests)
- `class-tracking.test.ts` (8 tests)
- `flush-phase5.test.ts` (5 tests)

Phase 6 should follow the same file naming: `mapper-phase6.test.ts`, `sync-po.test.ts`, `location-tracking.test.ts`, `qbo-reports.test.ts`, `token-check-cron.test.ts`.

---

## Dependencies & Integration Points

### Suggested Build Order (Waves)

**Wave 1 — Schema + Infrastructure (no UI dependencies)**
1. Prisma migration: `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderStatus`, `QboLocationMap`
2. WorkflowDefinition: add `autoInvoice Boolean @default(false)` + optional `autoInvoiceAmount`
3. qbo-types.ts: add `QboReportResponse`, `QboReportRow` types
4. qbo-client.ts: add `createPurchaseOrder`, `getPurchaseOrder`, `updatePurchaseOrder`, `createLocation`, `queryLocations`, `runReport`
5. qbo-mapper.ts: add `toQboPurchaseOrder` pure mapper

**Wave 2 — Core Sync Functions (depend on Wave 1)**
1. qbo-sync.ts: add `resolveOrCreateQboLocation(connection, orgId, siteId)` — mirrors `resolveOrCreateQboClass` exactly
2. qbo-sync.ts: add `syncPurchaseOrderToQbo(orgId, poId)` — uses vendorId cascade + class + location
3. qbo-sync.ts: retrofit all 5 existing sync functions with `DepartmentRef` parameter (syncInvoiceToQbo, syncQuoteToQbo, syncExpenseToQbo, syncTimeEntryToQbo, syncCreditMemoToQbo)
4. qbo-client.ts `createInvoice`: add `departmentRef` parameter
5. WO PATCH endpoint: add PM auto-invoice hook on COMPLETED transition
6. qbo-flush dispatcher: add `purchaseOrder:push` case

**Wave 3 — Cron + Reports API (depend on Wave 1, independent of Wave 2)**
1. New cron route: `GET /api/cron/qbo-token-check`
2. vercel.json: add 4th cron entry
3. New API route: `GET /api/integrations/qbo/reports` (normalize QBO report responses)

**Wave 4 — UI (depend on Wave 3 for reports, Wave 2 for banners)**
1. Analytics page: add tab structure + QBO Financial tab with 3 report sections + Recharts charts
2. QBO Health page: add location tracking warning banner (alongside existing class tracking banner) + token expired red banner
3. Integrations settings page: red dot indicator when connection inactive

**Wave 5 — Tests**
1. `mapper-phase6.test.ts` — `toQboPurchaseOrder` pure mapper
2. `sync-po.test.ts` — `syncPurchaseOrderToQbo` (mock vendor cascade, class, location)
3. `location-tracking.test.ts` — `resolveOrCreateQboLocation` (disabled/cached/auto-create paths)
4. `qbo-reports.test.ts` — report normalization, API route, Cash/Accrual toggle
5. `token-check-cron.test.ts` — proactive refresh, invalid_grant path, email alert, multi-org isolation
6. `flush-phase6.test.ts` — `purchaseOrder:push` dispatch routing

### What Depends on What
- `syncPurchaseOrderToQbo` depends on `syncVendorToQbo` (already exists), `resolveOrCreateQboClass` (already exists), `resolveOrCreateQboLocation` (new Wave 2)
- DepartmentRef retrofit of existing sync functions depends on `resolveOrCreateQboLocation` (Wave 2)
- PM auto-invoice hook depends on `enqueue` (already exists) and Invoice model (already exists)
- QBO Reports API depends on `runReport` client function (Wave 1)
- Analytics QBO Financial tab depends on the API route (Wave 3)
- Token check cron depends on `refreshAccessToken` (already exists) and `sendEmail` (already exists)

---

## Validation Architecture

### PO-01 Validation
- Unit test: `toQboPurchaseOrder` outputs correct `VendorRef`, `DepartmentRef`, `ClassRef`, `ItemBasedExpenseLineDetail` on lines
- Unit test: `syncPurchaseOrderToQbo` skips sync for non-SENT status (no such guard exists yet — verify PO is SENT before sync)
- Unit test: cascade vendor sync when `qboVendorId` is null
- Integration check: PO appears in QBO with correct vendor, lines, amounts, ClassRef, DepartmentRef

### DIM-02 Validation
- Unit test: `resolveOrCreateQboLocation` returns null when `locationTrackingEnabled=false`
- Unit test: returns cached QboRef when `QboLocationMap` exists
- Unit test: auto-creates QBO Department and caches when not found
- Unit test: never throws (catch → null)
- Integration check: retrofitted invoice sync includes `DepartmentRef` when site is set and location tracking enabled

### DIM-04 Validation
- Unit test: PATCH with `status=COMPLETED` on WO with `sourceWorkflowId` and `autoInvoice=true` triggers `createPmAutoInvoice`
- Unit test: WO without `sourceWorkflowId` does NOT trigger auto-invoice
- Unit test: schedule with `autoInvoice=false` does NOT trigger auto-invoice
- Unit test: Invoice is created with correct `customerId`, `siteId`, `workOrderId`
- Unit test: QBO sync is enqueued via `enqueue()`

### RPT-01 & RPT-02 Validation
- Unit test: `runReport` constructs correct URL path with all query params
- Unit test: report normalization handles empty Rows gracefully
- Unit test: P&L normalization extracts income/expense categories with correct amounts
- Unit test: A/R aging normalization extracts aging buckets
- Integration check: QBO Financial tab renders with real data, Cash/Accrual toggle changes data

### DASH-04 Validation
- Unit test: connections with `refreshTokenExpiry > 14 days` are NOT touched
- Unit test: connections with `refreshTokenExpiry <= 14 days` trigger proactive refresh
- Unit test: `invalid_grant` response sets `isActive=false` and sends email
- Unit test: successful refresh updates all token fields including new `refreshTokenExpiry`
- Unit test: multi-org isolation — one org failure does not stop processing others
- Integration check: token check cron route returns 401 without CRON_SECRET, 200 with it

---

## RESEARCH COMPLETE
