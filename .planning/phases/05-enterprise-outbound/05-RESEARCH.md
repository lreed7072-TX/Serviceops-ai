# Phase 5: Enterprise Outbound — Research

**Written:** 2026-03-09
**Requirements:** QUOT-03, VEND-01, TIME-01, TIME-02, EXP-01, DIM-01, DIM-03
**Status:** Ready for planning

---

## 1. Existing Code Analysis

### 1.1 qbo-types.ts — All Phase 5 Types Already Defined

`src/lib/qbo/qbo-types.ts` already contains every interface needed for Phase 5. No new types are
required in this file. Relevant types confirmed present:

| QBO Type | Used For | Key Fields |
|---|---|---|
| `QboEmployee` | TIME-01 | `Id`, `SyncToken`, `DisplayName`, `GivenName`, `FamilyName`, `PrimaryEmailAddr`, `BillableTime`, `BillRate` |
| `QboVendor` | VEND-01 | `Id`, `SyncToken`, `DisplayName`, `CompanyName`, `PrimaryEmailAddr`, `Vendor1099`, `TaxIdentifier`, `BillAddr` |
| `QboTimeActivity` | TIME-02 | `Id`, `SyncToken`, `TxnDate`, `NameOf`, `EmployeeRef`, `CustomerRef`, `ItemRef`, `ClassRef`, `BillableStatus`, `Hours`, `Minutes`, `HourlyRate` |
| `QboBill` | EXP-01 | `Id`, `SyncToken`, `VendorRef`, `Line` (with `AccountBasedExpenseLineDetail` including `ClassRef`), `TxnDate` |
| `QboPurchase` | EXP-01 | `Id`, `SyncToken`, `PaymentType`, `AccountRef`, `EntityRef`, `Line`, `TxnDate` |
| `QboCreditMemo` | QUOT-03 | `Id`, `SyncToken`, `CustomerRef`, `ClassRef`, `Line`, `LinkedTxn`, `TotalAmt` |
| `QboClass` | DIM-01 | `Id`, `SyncToken`, `Name`, `FullyQualifiedName`, `Active` |
| `QboPreferences` | DIM-03 | `AccountingInfoPrefs.ClassTrackingPerTxn`, `AccountingInfoPrefs.ClassTrackingPerTxnLine`, `AccountingInfoPrefs.TrackDepartments` |

**Critical detail on `QboLine`:** The existing `QboLine` type already has both
`AccountBasedExpenseLineDetail` (for Bills — account-based with `ClassRef`) and
`ItemBasedExpenseLineDetail` (for item-based expense lines with `ClassRef`). No type changes needed.

**Critical detail on `QboInvoice`:** Already has `ClassRef?: QboRef` at the top-level transaction
level. Retrofitting class tracking to existing `syncInvoiceToQbo()` is a field addition, not a type
change.

### 1.2 qbo-client.ts — Functions Present vs. Needed

**Currently present (27 functions):**
- OAuth: `getAuthorizationUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `getValidAccessToken`
- Customers: `createCustomer`, `updateCustomer`, `getCustomer`
- Invoices: `createInvoice`, `getInvoice`, `voidInvoice`, `sendInvoiceEmail`
- Payments: `getPayment`
- Items: `createItem`, `getItem`, `updateItem`
- Estimates: `createEstimate`, `getEstimate`, `updateEstimate`
- Utilities: `batchRequest`, `queryEntities`, `cdcRequest`, `verifyWebhookSignature`
- Company: `getCompanyInfo`

**New functions needed for Phase 5 (8 functions):**

| Function | Entity | Notes |
|---|---|---|
| `createEmployee(connection, data)` | Employee | POST `employee` endpoint |
| `getEmployee(connection, id)` | Employee | GET `employee/{id}` |
| `updateEmployee(connection, id, data)` | Employee | Fetch-merge-POST pattern (same as `updateCustomer`) |
| `createVendor(connection, data)` | Vendor | POST `vendor` endpoint |
| `getVendor(connection, id)` | Vendor | GET `vendor/{id}` |
| `updateVendor(connection, id, data)` | Vendor | Fetch-merge-POST pattern |
| `createTimeActivity(connection, data)` | TimeActivity | POST `timeactivity` endpoint |
| `getTimeActivity(connection, id)` | TimeActivity | GET `timeactivity/{id}` |
| `createBill(connection, data)` | Bill | POST `bill` endpoint |
| `getBill(connection, id)` | Bill | GET `bill/{id}` |
| `createPurchase(connection, data)` | Purchase | POST `purchase` endpoint |
| `createCreditMemo(connection, data)` | CreditMemo | POST `creditmemo` endpoint |
| `getCreditMemo(connection, id)` | CreditMemo | GET `creditmemo/{id}` |
| `getPreferences(connection)` | Preferences | GET `preferences` — no ID parameter |
| `createClass(connection, data)` | Class | POST `class` endpoint |
| `queryClasses(connection)` | Class | Shorthand for `queryEntities<QboClass>(..., "Class")` |

**Pattern for all new client functions:** All follow the existing `qboRequest()` + typed response
wrapper pattern. Update, create, get follows the established function signatures exactly:
- `createX(connection: QboConnection, data: Partial<QboType>): Promise<QboType>`
- `getX(connection: QboConnection, id: string): Promise<QboType>`
- `updateX(connection: QboConnection, id: string, data: Partial<QboType>): Promise<QboType>` — uses
  fetch-merge-POST (get existing, spread, override managed fields, POST complete payload)

**Note on `getPreferences`:** QBO Preferences endpoint is `GET company/{realmId}/preferences` — no
entity ID in the path. The `qboRequest()` call will be `GET preferences` (relative to the company
base URL).

### 1.3 qbo-sync.ts — Existing Sync Functions

The file is 1,234 lines and exports these sync functions that Phase 5 builds on or must retrofit:

| Function | Exported | Phase 5 Impact |
|---|---|---|
| `getActiveConnection(orgId)` | Yes | Used by all new sync functions — no change |
| `getAccountMapping(orgId, category)` | Yes | Used by EXP-01 for `job_cost_expense` and `subcontractor_expense` |
| `requireAccountMapping(orgId)` | Yes | Used as gate in bill/purchase sync |
| `resolveOrCreateQboEntity(connection, entityType, displayName, matchFn, createFn)` | Yes | Reused for Vendor and Employee DisplayName collision handling |
| `syncMaterialToQbo(orgId, materialId)` | Yes | No change, but called by `syncExpenseToQbo()` as a cascade |
| `syncLaborRateToQbo(orgId, laborRateId)` | Yes | No change |
| `syncCustomerToQbo(orgId, customerId)` | Yes | No change, but called as cascade from `syncTimeEntryToQbo()` |
| `syncQuoteToQbo(orgId, quoteId)` | Yes | No change |
| `syncInvoiceToQbo(orgId, invoiceId)` | Yes | **Must be retrofitted to add `ClassRef` when class tracking enabled** |
| `handleQboPaymentWebhook(payload)` | Yes | No change |
| `processPaymentJob(orgId, qboPaymentId, realmId)` | Yes | No change |
| `processInboundCustomer(orgId, qboCustomer, connectionId)` | Yes | No change |
| `processCdcCustomerPull(orgId, qboCustomerId, realmId)` | Yes | No change |
| `processCdcInvoiceChange(orgId, qboInvoiceId, realmId)` | Yes | No change |
| `processVoidInvoiceInQbo(orgId, invoiceId)` | Yes | No change |

**Retrofit requirement for `syncInvoiceToQbo`:** After class tracking is implemented, this function
must look up `workOrder.orderType` and call a new `resolveOrCreateQboClass()` helper, then include
`ClassRef` in the `createInvoice()` call. The existing `createInvoice()` in `qbo-client.ts` accepts
a raw object payload — adding `ClassRef` requires passing it through the `qboInvoice` record
construction block (lines 377-390 in qbo-client.ts).

### 1.4 qbo-mapper.ts — Existing Mapper Functions

Pure functions file, no I/O. Currently exports:
- `roundQboAmount(value)` — used in all new mappers
- `toQboCustomer(customer, existingQbo?)` — merge pattern
- `fromQboCustomer(qbo)` — inbound field split
- `toQboInvoiceLine(item, itemRef?)` — line builder
- `toQboInvoice(invoice, lineItems, customerRef, existingQbo?)` — merge pattern
- `toQboEstimate(quote, lineItems, customerRef, existingQbo?)` — merge pattern
- `toQboItem(source, type, incomeAccountRef, existingQbo?)` — merge pattern

**New mapper functions needed for Phase 5 (6 functions):**
- `toQboEmployee(user, existingQbo?)`
- `toQboVendor(vendor, existingQbo?)`
- `toQboTimeActivity(timeEntry, workOrder, qboEmployeeId, qboCustomerId, qboItemId?, classRef?)`
- `toQboBill(stockMovement, material, qboVendorId, expenseAccountRef, classRef?)`
- `toQboPurchase(stockMovement, material, expenseAccountRef, classRef?)`
- `toQboCreditMemo(invoice, qboCustomerId, classRef?)`

**Mapper rules (from file header comment, must follow):**
- Every function is pure: no database calls, no API calls, no side effects
- No `await` or `Promise` in any function signature or body
- No `import { prisma }` or `import fetch`
- All monetary values pass through `roundQboAmount()`
- Merge pattern: when `existingQbo` is provided, spread it before applying changes

### 1.5 qbo-queue.ts — Queue Pattern (No Changes Needed)

`src/lib/qbo/qbo-queue.ts` exports `enqueue()`, `claimBatch()`, `complete()`, `fail()`,
`resetStaleLocks()`, `getDeadLetters()`, `requeueDeadLetter()`.

The `enqueue()` signature is:
```typescript
enqueue(orgId, connectionId, entityType, entityId, action, priority?, payload?)
```

Phase 5 will call `enqueue()` with these new `entityType:action` combinations:
- `vendor:push` — triggered when Vendor is created/updated
- `employee:push` — triggered when TECH user first creates a TimeEntry without qboEmployeeId
- `timeActivity:push` — triggered when TimeEntry.status transitions to STOPPED
- `bill:push` — triggered when StockMovement PURCHASE is created with a linked Vendor
- `purchase:push` — triggered when StockMovement PURCHASE is created without a linked Vendor
- `creditMemo:push` — triggered when an Invoice credit is issued (manual action or status change)

**No changes to qbo-queue.ts are needed.** The queue is entity-type-agnostic by design.

### 1.6 qbo-flush/route.ts — Current Dispatcher Cases

`src/app/api/cron/qbo-flush/route.ts` currently handles these `entityType:action` switch cases:
- `customer:push`
- `invoice:push`
- `invoice:email` (throws — routes to dedicated endpoint)
- `item:push` (with `payload.sourceType === "laborRate"` branch)
- `estimate:push`
- `payment:pull`
- `invoice:pull`
- `customer:pull`
- `invoice:void`
- `default` (throws unhandled)

**New cases needed for Phase 5:**
- `vendor:push` → calls `syncVendorToQbo(job.orgId, job.entityId)`
- `employee:push` → calls `syncEmployeeToQbo(job.orgId, job.entityId)`
- `timeActivity:push` → calls `syncTimeEntryToQbo(job.orgId, job.entityId)`
- `bill:push` → calls `syncExpenseToQbo(job.orgId, job.entityId)` (dispatcher reads `payload.expenseType === "bill"`)
- `purchase:push` → calls `syncExpenseToQbo(job.orgId, job.entityId)` (dispatcher reads `payload.expenseType === "purchase"`)
- `creditMemo:push` → calls `syncCreditMemoToQbo(job.orgId, job.entityId)`

Alternative design: a single `expense:push` case that branches on `payload.expenseType`. Either
approach works; separate cases are more explicit and consistent with the `item:push` sourceType
pattern already in use.

### 1.7 qbo-cdc/route.ts — Extension Point for Preferences

`src/app/api/cron/qbo-cdc/route.ts` runs every 4 hours and iterates over all active connections.
Each connection calls `pollOrgCdc(connection, stats)`. The preferences fetch belongs here as a
per-connection side-effect alongside the CDC poll.

The preferences fetch does not require a queue job — it is a direct API call followed by a DB
update on `QboConnection`. It should be added to the existing `pollOrgCdc` function body.

---

## 2. Schema Changes Required

### 2.1 New Vendor Model

The `Vendor` model does not exist yet. It must be created as a standalone model (not mapped from
`Material.manufacturer`). The `Vendor` model supports both material suppliers and subcontractors.

```prisma
enum VendorType {
  SUPPLIER      // Material/parts supplier
  SUBCONTRACTOR // Labor subcontractor (likely needs 1099)
  OTHER
}

model Vendor {
  id          String     @id @default(uuid()) @db.Uuid
  orgId       String     @db.Uuid
  name        String     // Primary display name
  companyName String?    // Legal company name (may differ from display name)
  email       String?
  phone       String?
  address     String?
  city        String?
  state       String?
  postalCode  String?
  vendorType  VendorType @default(SUPPLIER)
  tax1099     Boolean    @default(false) // True for subcontractors by default
  isActive    Boolean    @default(true)
  notes       String?    @db.Text
  qboVendorId String?    // QBO Vendor entity ID after sync
  qboSyncedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  org       Org        @relation(fields: [orgId], references: [id])
  materials Material[] // Materials supplied by this vendor

  @@index([orgId])
  @@index([orgId, isActive])
  @@index([orgId, vendorType])
}
```

**1099 default decision:** Default `false` for SUPPLIER type; callers should set `true` for
SUBCONTRACTOR. The auto-link logic (when a Vendor is created, link Materials with matching
`manufacturer` name) will run in the Vendor creation API route.

### 2.2 Additions to Existing Models

**User model** — add `qboEmployeeId`:
```prisma
qboEmployeeId String? // QBO Employee entity ID after sync (TECH users only)
```

**Material model** — add `vendorId` FK:
```prisma
vendorId    String?   @db.Uuid  // Supplier/vendor for this material
vendor      Vendor?   @relation(fields: [vendorId], references: [id])
```

**StockMovement model** — add `qboBillId` and `qboPurchaseId`:
```prisma
qboBillId     String? // QBO Bill entity ID (set when vendor linked)
qboPurchaseId String? // QBO Purchase entity ID (set when no vendor)
```

**QboConnection model** — add three Preferences fields:
```prisma
classTrackingEnabled      Boolean?  // From QBO Preferences.AccountingInfoPrefs.ClassTrackingPerTxn
locationTrackingEnabled   Boolean?  // From QBO Preferences.AccountingInfoPrefs.TrackDepartments
preferencesLastCheckedAt  DateTime? // When preferences were last fetched from QBO
```

**Org model** — add `vendors` relation back-reference:
```prisma
vendors Vendor[]
```

### 2.3 New QboClassMap Model (Class Tracking Storage)

The decision in CONTEXT.md leaves storage approach to Claude's discretion. A lightweight DB table
is recommended over an in-memory map for serverless compatibility (in-memory maps reset between
invocations).

```prisma
model QboClassMap {
  id           String  @id @default(uuid()) @db.Uuid
  orgId        String  @db.Uuid
  orderType    String  // "WORK_ORDER" | "SERVICE_ORDER" | "PROJECT" | "MAINTENANCE"
  qboClassId   String  // QBO Class entity ID
  qboClassName String  // Display name (cached for logging)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  org Org @relation(fields: [orgId], references: [id])

  @@unique([orgId, orderType])
  @@index([orgId])
}
```

**Org model** gets `qboClassMaps QboClassMap[]` back-reference.

**Why DB over in-memory:** Serverless functions do not share memory. The `qboClassMaps` table is
queried once per sync function invocation and is a tiny table (4 rows per org maximum). The
`@@unique([orgId, orderType])` constraint enables upsert semantics for auto-create.

### 2.4 WorkOrder orderType Enum — Current Values

The `OrderType` enum in the schema currently has three values:
```prisma
enum OrderType {
  WORK_ORDER
  SALES_ORDER
  PROJECT
}
```

CONTEXT.md references four class labels (WORK_ORDER, SERVICE_ORDER, PROJECT, MAINTENANCE) but the
schema only has WORK_ORDER, SALES_ORDER, PROJECT. **The QboClassMap table stores `orderType` as a
String (not an enum reference)** to avoid coupling. Map the existing enum values to class names:
- `WORK_ORDER` → "Work Order"
- `SALES_ORDER` → "Sales Order"
- `PROJECT` → "Project"

If MAINTENANCE is added to the schema in a future phase, the class mapping extends naturally.

---

## 3. New QBO Client Functions — Full Specifications

All new functions go in `src/lib/qbo/qbo-client.ts`. Each follows the same pattern as existing
functions. The private `qboRequest()` function handles auth, base URL, and minorversion.

### 3.1 Employee CRUD

```typescript
// Create
async function createEmployee(
  connection: QboConnection,
  data: Partial<QboEmployee>
): Promise<QboEmployee>
// — POST "employee", response.Employee

// Get
async function getEmployee(
  connection: QboConnection,
  qboEmployeeId: string
): Promise<QboEmployee>
// — GET "employee/{qboEmployeeId}", response.Employee

// Update (fetch-merge-POST)
async function updateEmployee(
  connection: QboConnection,
  qboEmployeeId: string,
  data: Partial<QboEmployee>
): Promise<QboEmployee>
// — getEmployee() → spread → override → POST "employee"
```

### 3.2 Vendor CRUD

```typescript
async function createVendor(connection, data: Partial<QboVendor>): Promise<QboVendor>
// — POST "vendor", response.Vendor

async function getVendor(connection, qboVendorId: string): Promise<QboVendor>
// — GET "vendor/{id}", response.Vendor

async function updateVendor(connection, qboVendorId: string, data: Partial<QboVendor>): Promise<QboVendor>
// — getVendor() → spread → override → POST "vendor"
```

### 3.3 TimeActivity

```typescript
async function createTimeActivity(connection, data: Partial<QboTimeActivity>): Promise<QboTimeActivity>
// — POST "timeactivity", response.TimeActivity

async function getTimeActivity(connection, id: string): Promise<QboTimeActivity>
// — GET "timeactivity/{id}", response.TimeActivity
```

Note: Time activities are immutable in QBO after creation (no update API). Idempotency is handled
by checking `qboTimeActivityId` on the `TimeEntry` before creating.

### 3.4 Bill and Purchase

```typescript
async function createBill(connection, data: Partial<QboBill>): Promise<QboBill>
// — POST "bill", response.Bill

async function getBill(connection, id: string): Promise<QboBill>
// — GET "bill/{id}", response.Bill

async function createPurchase(connection, data: Partial<QboPurchase>): Promise<QboPurchase>
// — POST "purchase", response.Purchase
```

### 3.5 CreditMemo

```typescript
async function createCreditMemo(connection, data: Partial<QboCreditMemo>): Promise<QboCreditMemo>
// — POST "creditmemo", response.CreditMemo

async function getCreditMemo(connection, id: string): Promise<QboCreditMemo>
// — GET "creditmemo/{id}", response.CreditMemo
```

### 3.6 Preferences

```typescript
async function getPreferences(connection: QboConnection): Promise<QboPreferences>
// — GET "preferences", response.Preferences
// Note: no entity ID in the path — one preferences object per company
```

### 3.7 Class

```typescript
async function createClass(connection, data: { Name: string }): Promise<QboClass>
// — POST "class", response.Class

async function queryClasses(connection: QboConnection): Promise<QboClass[]>
// — Thin wrapper: queryEntities<QboClass>(connection, "SELECT * FROM Class WHERE Active = true", "Class")
```

### 3.8 Export Updates

`qbo-client.ts` currently imports and re-exports specific types from `qbo-types.ts` on line 4.
The import line must be extended to include:
```typescript
import type { ..., QboEmployee, QboVendor, QboTimeActivity, QboBill, QboPurchase, QboCreditMemo, QboClass, QboPreferences } from "./qbo-types";
export type { ..., QboEmployee, QboVendor, QboTimeActivity, QboBill, QboPurchase, QboCreditMemo, QboClass, QboPreferences };
```

---

## 4. New Mapper Functions — Full Specifications

All new mappers go in `src/lib/qbo/qbo-mapper.ts`. All are pure, synchronous, no I/O.

### 4.1 toQboEmployee

```typescript
export function toQboEmployee(
  user: Pick<User, "name" | "email">,
  existingQbo?: QboEmployee
): Partial<QboEmployee>
```

- `DisplayName`: use `user.name` if non-null, else email prefix (part before `@`)
- `GivenName` / `FamilyName`: split `user.name` on first space if present
- `PrimaryEmailAddr`: `{ Address: user.email }`
- `BillableTime`: `true` — all TECH users are billable by default
- Merge pattern: if `existingQbo` provided, spread first then override

**Import needed:** `import type { User } from "@prisma/client"` (User is already imported by
qbo-mapper.ts for the `Customer` type — verify import block).

### 4.2 toQboVendor

```typescript
export function toQboVendor(
  vendor: Pick<Vendor, "name" | "companyName" | "email" | "phone" | "address" | "city" | "state" | "postalCode" | "tax1099">,
  existingQbo?: QboVendor
): Partial<QboVendor>
```

- `DisplayName`: use `vendor.name`
- `CompanyName`: use `vendor.companyName` if provided
- `PrimaryEmailAddr`: `{ Address: vendor.email }` if provided
- `PrimaryPhone`: `{ FreeFormNumber: vendor.phone }` if provided
- `BillAddr`: address fields if any provided
- `Vendor1099`: `vendor.tax1099`
- `PrintOnCheckName`: `vendor.companyName ?? vendor.name`

**Note:** `Vendor` is a new Prisma model — its type will be auto-generated after migration. The
mapper uses a `Pick<>` type so it can be written before the migration runs.

### 4.3 toQboTimeActivity

```typescript
export function toQboTimeActivity(
  timeEntry: Pick<TimeEntry, "startedAt" | "stoppedAt" | "accumulatedSeconds" | "notes">,
  qboEmployeeId: string,
  qboCustomerId: string,
  options?: {
    qboItemId?: string;     // QBO Item ID for the labor rate (service item)
    classRef?: QboRef;      // ClassRef when class tracking enabled
    billable?: boolean;     // Default true; false for warranty/internal work
    hourlyRate?: number;    // For HourlyRate field on QBO TimeActivity
  }
): Partial<QboTimeActivity>
```

**Hours/Minutes calculation from ServiceOps TimeEntry:**
- A stopped TimeEntry has `accumulatedSeconds` (seconds before last segment) + the segment duration
  (`stoppedAt` - `startedAt` after final stop)
- Total seconds: the sync function computes this before calling the mapper
- Pass pre-computed `totalHours` and `totalMinutes` to the mapper or pass `totalSeconds`:
  `hours = Math.floor(totalSeconds / 3600)`, `minutes = Math.round((totalSeconds % 3600) / 60)`
- `TxnDate`: format `timeEntry.startedAt` as `YYYY-MM-DD`
- `NameOf`: always `"Employee"` for TECH users
- `BillableStatus`: `options?.billable === false ? "NotBillable" : "Billable"`

**Billable classification logic (Claude's discretion per CONTEXT.md):** Check WorkOrder context in
the sync function before calling the mapper. If WorkOrder has a `sourceWorkflowId` and the PM
workflow has a billing flag, it is non-billable. If WorkOrder `orderType === "WORK_ORDER"` or
`"PROJECT"`, default to billable. This classification happens in `syncTimeEntryToQbo()`, not the
pure mapper.

### 4.4 toQboBill

```typescript
export function toQboBill(
  stockMovement: Pick<StockMovement, "totalCost" | "unitCost" | "quantity" | "reference" | "notes" | "createdAt">,
  material: Pick<Material, "name">,
  qboVendorId: string,
  expenseAccountRef: { value: string; name?: string }, // from getAccountMapping("job_cost_expense" | "subcontractor_expense")
  options?: { classRef?: QboRef }
): Partial<QboBill>
```

- `VendorRef`: `{ value: qboVendorId }`
- `TxnDate`: format `stockMovement.createdAt` as `YYYY-MM-DD`
- `DocNumber`: `stockMovement.reference` if provided
- `Line`: single `AccountBasedExpenseLineDetail` line:
  - `Amount`: `roundQboAmount(stockMovement.totalCost)`
  - `AccountRef`: `expenseAccountRef`
  - `ClassRef`: `options?.classRef` if provided
  - `Description`: `material.name` + quantity if available

### 4.5 toQboPurchase

```typescript
export function toQboPurchase(
  stockMovement: Pick<StockMovement, "totalCost" | "reference" | "notes" | "createdAt">,
  material: Pick<Material, "name">,
  expenseAccountRef: { value: string; name?: string },
  options?: { classRef?: QboRef }
): Partial<QboPurchase>
```

- `PaymentType`: `"Cash"` (default for purchases without a vendor — credit card or check
  categorization requires additional data not in StockMovement; `"Cash"` is QBO's neutral default)
- `AccountRef`: expense account (the cash/checking account the purchase was paid from — this is the
  "payment account" not the expense category). **Design decision needed:** the `AccountRef` on a
  Purchase is the payment account (asset), not the expense account. The expense categorization goes
  in the Line's `AccountBasedExpenseLineDetail.AccountRef`. See QBO API docs. The purchase-level
  `AccountRef` defaults to the Checking account. Plan should expose a "default payment account"
  setting or hardcode Uncategorized Asset until the user configures it.
- `TxnDate`: format `stockMovement.createdAt` as `YYYY-MM-DD`
- `DocNumber`: `stockMovement.reference`
- `Line`: `AccountBasedExpenseLineDetail` with expense account and `ClassRef`

**Important note for planner:** The QBO Purchase entity requires two account references:
1. `Purchase.AccountRef` — the payment method account (asset/liability: Checking, Credit Card, etc.)
2. `Line[].AccountBasedExpenseLineDetail.AccountRef` — the expense category account

This is a QBO API design quirk not present in Bills (which use AP). The plan needs to address how
to resolve the payment account — either a new "expense payment account" mapping category, or derive
it from existing account maps.

### 4.6 toQboCreditMemo

```typescript
export function toQboCreditMemo(
  invoice: Pick<Invoice, "total" | "invoiceNumber" | "notes">,
  lineItems: Array<Pick<InvoiceLineItem, "description" | "totalPrice" | "quantity" | "unitPrice">>,
  qboCustomerId: string,
  qboInvoiceId: string, // For LinkedTxn
  options?: { classRef?: QboRef }
): Partial<QboCreditMemo>
```

- `CustomerRef`: `{ value: qboCustomerId }`
- `Line`: map each line item using same pattern as `toQboInvoiceLine()`
- `LinkedTxn`: `[{ TxnId: qboInvoiceId, TxnType: "Invoice" }]`
- `ClassRef`: `options?.classRef` at the transaction level
- `DocNumber`: `"CM-" + invoice.invoiceNumber` as a convention
- `CustomerMemo`: `invoice.notes` if provided

---

## 5. New Sync Functions — Full Specifications

All new sync functions go in `src/lib/qbo/qbo-sync.ts`. All follow the established pattern:
- Signature: `async function syncXToQbo(orgId: string, entityId: string): Promise<{success: boolean; error?: string}>`
- Open with `getActiveConnection(orgId)` guard
- Try/catch wrapping all QBO API calls
- `QboSyncLog.create` on both success and failure paths
- Multi-tenant: all Prisma queries include `orgId`

### 5.1 syncVendorToQbo (VEND-01)

```typescript
async function syncVendorToQbo(
  orgId: string,
  vendorId: string
): Promise<{ success: boolean; qboVendorId?: string; error?: string }>
```

**Flow:**
1. `getActiveConnection(orgId)` guard
2. Fetch `Vendor` from DB with `orgId` guard
3. If `vendor.qboVendorId` exists: fetch + merge + update via `updateVendor()`
4. If no `qboVendorId`: use `resolveOrCreateQboEntity<QboVendor>()` with:
   - `entityType`: `"Vendor"` (QBO IQL entity name)
   - `displayName`: `vendor.name`
   - `matchFn`: match on email if available (`existing.PrimaryEmailAddr?.Address?.toLowerCase() === vendor.email?.toLowerCase()`)
   - `createFn`: calls `createVendor(connection, toQboVendor(vendor))`
5. Store `qboVendorId` on the `Vendor` record
6. Log success to `QboSyncLog`

### 5.2 syncEmployeeToQbo (TIME-01)

```typescript
async function syncEmployeeToQbo(
  orgId: string,
  userId: string
): Promise<{ success: boolean; qboEmployeeId?: string; error?: string }>
```

**Flow:**
1. `getActiveConnection(orgId)` guard
2. Fetch `User` with `where: { id: userId, orgId, role: "TECH" }` — enforce TECH role guard
3. If `user.qboEmployeeId` exists: fetch + merge + update via `updateEmployee()`
4. If no `qboEmployeeId`: use `resolveOrCreateQboEntity<QboEmployee>()` with:
   - `entityType`: `"Employee"` (QBO IQL entity name)
   - `displayName`: display name from `toQboEmployee()` logic
   - `matchFn`: match on email (`existing.PrimaryEmailAddr?.Address?.toLowerCase() === user.email.toLowerCase()`)
   - `createFn`: calls `createEmployee(connection, toQboEmployee(user))`
5. Store `qboEmployeeId` on `User` record
6. Log success

### 5.3 syncTimeEntryToQbo (TIME-02)

```typescript
async function syncTimeEntryToQbo(
  orgId: string,
  timeEntryId: string
): Promise<{ success: boolean; qboTimeActivityId?: string; error?: string }>
```

**Flow (cascade pattern):**
1. `getActiveConnection(orgId)` guard
2. Fetch `TimeEntry` with includes: `user`, `workOrder { customer, orderType }`, `taskInstance`
3. Guard: `timeEntry.status !== "STOPPED"` → return error "TimeEntry must be STOPPED to sync"
4. Guard: `timeEntry.user.role !== "TECH"` → return error "Only TECH users sync to QBO employees"
5. If already synced (`qboTimeActivityId` exists): return `{ success: true, qboTimeActivityId }`
6. **Cascade: ensure employee is synced first**
   - If `timeEntry.user.qboEmployeeId` is null: call `syncEmployeeToQbo(orgId, timeEntry.userId)`
   - Re-fetch user to get fresh `qboEmployeeId`
7. **Cascade: ensure customer is synced**
   - If `workOrder.customer.qboCustomerId` is null: call `syncCustomerToQbo(orgId, workOrder.customerId)`
   - Re-fetch customer for `qboCustomerId`
8. **Optional: resolve labor rate item** (for `ItemRef` on the time activity)
   - If task has a linked labor rate with `qboItemId`: use it. Otherwise skip (ItemRef is optional on QBO TimeActivity)
9. **Compute total seconds:** `timeEntry.accumulatedSeconds` is the accumulated time. For a STOPPED
   entry, the final segment seconds = `(stoppedAt - startedAt).seconds - accumulatedSecondsAtLastPause`.
   Simplest approach: use `accumulatedSeconds` as the authoritative total for a STOPPED entry (the
   existing timer logic updates `accumulatedSeconds` on stop). Total hours/minutes derived from that.
10. **Billable classification:** if `workOrder.sourceWorkflowId` is non-null (PM-generated WO) →
    `billable = false`; otherwise `billable = true`
11. **Class tracking:** call `resolveOrCreateQboClass(connection, orgId, workOrder.orderType)` → returns
    `QboRef | null` (null when class tracking disabled or class creation fails gracefully)
12. Build payload: `toQboTimeActivity(timeEntry, qboEmployeeId, qboCustomerId, { qboItemId, classRef, billable })`
13. `createTimeActivity(connection, payload)` → store `qboTimeActivityId` on `TimeEntry`
14. Log success

### 5.4 syncExpenseToQbo (EXP-01)

```typescript
async function syncExpenseToQbo(
  orgId: string,
  stockMovementId: string
): Promise<{ success: boolean; qboExpenseId?: string; error?: string }>
```

**Flow:**
1. `getActiveConnection(orgId)` guard
2. Account mapping gate: `requireAccountMapping(orgId)` — must be complete
3. Fetch `StockMovement` with includes: `material { vendor }`, `performedBy { workOrder? }`
4. Guard: `movementType !== "PURCHASE"` → return error "Only PURCHASE movements sync as expenses"
5. Guard: `totalCost` is null or zero → skip (no cost to record)
6. Already synced guard: if `qboBillId` or `qboPurchaseId` exists → return success (idempotent)
7. **Expense account:** if `material.vendor?.vendorType === "SUBCONTRACTOR"`: use `subcontractor_expense` category; else use `job_cost_expense` category
8. **Class tracking:** if `StockMovement` is linked to a work order via material usage chain → resolve class. If not linked: skip ClassRef (purchases may not have a WO context)
9. **Bill vs Purchase branching:**
   - If `material.vendorId` is non-null (vendor linked):
     - Cascade: if `material.vendor.qboVendorId` is null → call `syncVendorToQbo(orgId, material.vendorId)`
     - Re-fetch vendor for `qboVendorId`
     - Build bill payload: `toQboBill(stockMovement, material, qboVendorId, expenseAccountRef, { classRef })`
     - `createBill(connection, payload)` → store `qboBillId`
   - If `material.vendorId` is null (no vendor):
     - Build purchase payload: `toQboPurchase(stockMovement, material, expenseAccountRef, { classRef })`
     - `createPurchase(connection, payload)` → store `qboPurchaseId`
10. Log success

**Note on Purchase `AccountRef`:** See section 4.5. For MVP, use a hardcoded "Uncategorized Asset"
fallback or add a 6th account mapping category `expense_payment_account`. The plan must decide.

### 5.5 syncCreditMemoToQbo (QUOT-03)

```typescript
async function syncCreditMemoToQbo(
  orgId: string,
  invoiceId: string
): Promise<{ success: boolean; qboCreditMemoId?: string; error?: string }>
```

**Flow:**
1. `getActiveConnection(orgId)` guard
2. Account mapping gate
3. Fetch `Invoice` with includes: `customer`, `lineItems`, workOrder (for class tracking)
4. Guard: must have `qboInvoiceId` to create a linked credit memo
5. Guard: must have `customer.qboCustomerId` (or cascade-sync customer)
6. **Class tracking:** if invoice has a linked work order, resolve class
7. Build payload: `toQboCreditMemo(invoice, lineItems, qboCustomerId, qboInvoiceId, { classRef })`
8. `createCreditMemo(connection, payload)` → store `qboCreditMemoId` on Invoice record
9. Log success

**Trigger mechanism decision (left to Claude's discretion per CONTEXT.md):** Recommend a manual
"Issue Credit" button on the invoice detail page that POSTs to a dedicated endpoint
`POST /api/invoices/[id]/credit`. This is cleaner than a status transition because:
- Credit memos can be issued without changing the invoice status in all cases
- A new `CREDITED` status would require schema changes and could conflict with existing PAID/CANCELED
- The manual action matches how field service companies actually issue credits (exceptional, not
  routine)

The invoice needs a `qboCreditMemoId String?` field to track sync state.

### 5.6 resolveOrCreateQboClass (DIM-01 helper)

This is a new helper function in `qbo-sync.ts`, not a top-level sync function:

```typescript
async function resolveOrCreateQboClass(
  connection: QboConnection,
  orgId: string,
  orderType: string // WorkOrder.orderType value
): Promise<QboRef | null>
```

**Flow:**
1. Check `QboConnection.classTrackingEnabled` on the current connection — if `false` or `null`:
   return `null` (silently skip)
2. Check `QboClassMap` for `{ orgId, orderType }` — if found, return `{ value: qboClassId, name: qboClassName }`
3. If not found: auto-create the class in QBO
   - Class name: human-readable mapping of orderType enum value
     - `WORK_ORDER` → `"Work Order"`
     - `SALES_ORDER` → `"Sales Order"`
     - `PROJECT` → `"Project"`
   - `createClass(connection, { Name: className })`
   - Upsert `QboClassMap` with the new class ID and name
   - Return `{ value: newClass.Id, name: className }`
4. On any error: log warning and return `null` (class tracking failure must never block a sync)

### 5.7 fetchAndCachePreferences (DIM-03 helper)

New helper added to `qbo-sync.ts` and called from the CDC cron:

```typescript
async function fetchAndCachePreferences(
  connection: QboConnection
): Promise<{ classTrackingEnabled: boolean; locationTrackingEnabled: boolean }>
```

**Flow:**
1. `getPreferences(connection)` — fetch from QBO API
2. Extract `AccountingInfoPrefs.ClassTrackingPerTxn` (or `ClassTrackingPerTxnLine` for line-level) →
   `classTrackingEnabled`
3. Extract `AccountingInfoPrefs.TrackDepartments` → `locationTrackingEnabled`
4. Update `QboConnection` with the three new fields: `classTrackingEnabled`, `locationTrackingEnabled`,
   `preferencesLastCheckedAt: new Date()`
5. Return the extracted flags

**Called from:** `pollOrgCdc()` in `qbo-cdc/route.ts` — once per 4-hour cycle per org. If
preferences have been checked in the last 23 hours (`preferencesLastCheckedAt > now - 23h`), skip
the API call (cache is fresh enough).

---

## 6. Flush Dispatcher Extensions

`src/app/api/cron/qbo-flush/route.ts` — add to `dispatchJob()` switch statement:

```typescript
case "vendor:push": {
  const vendorResult = await syncVendorToQbo(job.orgId, job.entityId);
  if (!vendorResult.success) throw new Error(vendorResult.error || "Vendor sync failed");
  break;
}

case "employee:push": {
  const empResult = await syncEmployeeToQbo(job.orgId, job.entityId);
  if (!empResult.success) throw new Error(empResult.error || "Employee sync failed");
  break;
}

case "timeActivity:push": {
  const taResult = await syncTimeEntryToQbo(job.orgId, job.entityId);
  if (!taResult.success) throw new Error(taResult.error || "Time activity sync failed");
  break;
}

case "expense:push": {
  // payload.expenseType distinguishes bill vs purchase (both use same sync function)
  const expResult = await syncExpenseToQbo(job.orgId, job.entityId);
  if (!expResult.success) throw new Error(expResult.error || "Expense sync failed");
  break;
}

case "creditMemo:push": {
  const cmResult = await syncCreditMemoToQbo(job.orgId, job.entityId);
  if (!cmResult.success) throw new Error(cmResult.error || "Credit memo sync failed");
  break;
}
```

**Import additions needed at top of route.ts:**
```typescript
import {
  // existing imports...
  syncVendorToQbo,
  syncEmployeeToQbo,
  syncTimeEntryToQbo,
  syncExpenseToQbo,
  syncCreditMemoToQbo,
} from "@/lib/qbo/qbo-sync";
```

---

## 7. Auto-Enqueue Trigger Points

Phase 5 sync is event-driven. The following API routes must be modified to enqueue jobs:

### 7.1 StockMovement PURCHASE — expense:push

`POST /api/stock-movements` (or wherever StockMovement creation happens): After creating a
`StockMovement` with `movementType === "PURCHASE"`, check if active QBO connection exists and
enqueue `expense:push`:

```typescript
if (newMovement.movementType === "PURCHASE" && connection) {
  await enqueue(orgId, connection.id, "expense", newMovement.id, "push", 5, {
    expenseType: newMovement.material?.vendorId ? "bill" : "purchase"
  });
}
```

### 7.2 TimeEntry STOPPED — timeActivity:push

The TimeEntry status update endpoint (`PATCH /api/time-entries/[id]` or similar): When status
transitions to `"STOPPED"`, enqueue `timeActivity:push`:

```typescript
if (body.status === "STOPPED" && existing.status !== "STOPPED" && connection) {
  await enqueue(orgId, connection.id, "timeActivity", timeEntryId, "push", 5);
}
```

### 7.3 Credit Memo — creditMemo:push

New dedicated endpoint `POST /api/invoices/[id]/credit`:
```typescript
await enqueue(orgId, connection.id, "creditMemo", invoiceId, "push", 1);
```

### 7.4 Vendor Created/Updated — vendor:push

`POST /api/vendors` and `PATCH /api/vendors/[id]`:
```typescript
await enqueue(orgId, connection.id, "vendor", vendor.id, "push", 5);
```

---

## 8. API Routes Required

### 8.1 Vendor CRUD

New routes at `src/app/api/vendors/`:
- `GET /api/vendors` — list vendors with pagination (same pattern as materials)
- `POST /api/vendors` — create vendor + auto-link materials by manufacturer name + enqueue `vendor:push`
- `GET /api/vendors/[id]` — get single vendor
- `PATCH /api/vendors/[id]` — update vendor + enqueue `vendor:push`
- `DELETE /api/vendors/[id]` — soft delete (set `isActive: false`)

### 8.2 Credit Memo Trigger

- `POST /api/invoices/[id]/credit` — ADMIN/DISPATCHER only; creates QboSyncJob for `creditMemo:push`;
  stores intent in invoice (could set a flag `hasCreditMemo: Boolean?` on Invoice)

### 8.3 QBO Preferences Status

Extends existing `GET /api/integrations/qbo/health` to include `classTrackingEnabled` and
`locationTrackingEnabled` from `QboConnection`. The health dashboard will read these.

No new API route needed — health endpoint already queries `QboConnection` fields.

---

## 9. UI Changes Required

### 9.1 QBO Health Dashboard — Preferences Warning Banner (DIM-03)

`src/app/(app)/settings/integrations/qbo-health/page.tsx` already shows connection status. Add a
yellow info banner (using existing CSS variable `--warning` or inline orange/amber styling):

**Condition:** `connection.classTrackingEnabled === false`
**Message:** "Class tracking is disabled in your QBO company settings — enable it under Account
and Settings > Advanced > Categories to segment your P&L by work type."
**Link:** Deep link to QBO settings (not possible via API — just show the instruction text)

The banner component already exists in the codebase (`Toast` for notifications; for a persistent
banner, look at the existing `account-mapping` warning in the integrations page).

### 9.2 Invoice Detail — Issue Credit Button (QUOT-03)

`src/app/(app)/invoices/[id]/page.tsx`: Add an "Issue Credit" button visible only when:
- Invoice has `qboInvoiceId` (is synced to QBO)
- Invoice status is `PAID` or `SENT` (not already canceled or draft)

The button opens a confirmation dialog ("This will create a credit memo in QuickBooks for the full
invoice amount. Continue?") then calls `POST /api/invoices/[id]/credit`.

### 9.3 Sync-Trigger Extension (DASH-03)

`POST /api/integrations/qbo/sync-trigger` currently accepts `entityType` values:
`"customers" | "invoices" | "items" | "estimates"`. Add:
- `"vendors"` — enqueue `vendor:push` for all unsynced vendors
- `"employees"` — enqueue `employee:push` for all TECH users without `qboEmployeeId`

The health dashboard's manual sync trigger UI would need new entity type buttons for Vendors and
Employees.

---

## 10. Retrofit: syncInvoiceToQbo with ClassRef (DIM-01)

The existing `syncInvoiceToQbo()` in `qbo-sync.ts` must be extended to apply `ClassRef`:

```typescript
// After cascade syncs complete, before createInvoice() call:
let classRef: QboRef | undefined;
if (invoice.workOrderId) {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: invoice.workOrderId, orgId },
    select: { orderType: true },
  });
  if (workOrder) {
    const resolvedClass = await resolveOrCreateQboClass(connection, orgId, workOrder.orderType);
    classRef = resolvedClass ?? undefined;
  }
}

// Pass classRef into createInvoice():
const qboInvoice = await createInvoice(connection, {
  customerRef: qboCustomerId,
  lineItems: qboLines,
  dueDate: ...,
  docNumber: ...,
  linkedTxn,
  classRef, // New parameter
});
```

`createInvoice()` in `qbo-client.ts` must accept an optional `classRef` parameter and include it
in the QBO payload as `ClassRef: { value: classRef.value }`.

Same retrofit for `syncQuoteToQbo()` (invoices and estimates both support `ClassRef`).

---

## 11. Wave Grouping — Dependency Order

Based on dependency analysis, Phase 5 should execute in 4 waves:

### Wave 1 — Schema + Types + Client (Foundation, no dependencies)

Deliverables:
- Prisma migration: `Vendor` model, `VendorType` enum, `QboClassMap` model, `qboEmployeeId` on
  `User`, `vendorId` on `Material`, `qboBillId`/`qboPurchaseId` on `StockMovement`, three
  preferences fields on `QboConnection`, `qboCreditMemoId` on `Invoice`
- `qbo-client.ts`: 16 new functions (createEmployee, getEmployee, updateEmployee, createVendor,
  getVendor, updateVendor, createTimeActivity, getTimeActivity, createBill, getBill, createPurchase,
  createCreditMemo, getCreditMemo, getPreferences, createClass, queryClasses)
- `qbo-mapper.ts`: 6 new pure mapper functions (toQboEmployee, toQboVendor, toQboTimeActivity,
  toQboBill, toQboPurchase, toQboCreditMemo)

### Wave 2 — Sync Functions (depend on Wave 1 schema + client + mapper)

Deliverables:
- `qbo-sync.ts`: `syncVendorToQbo`, `syncEmployeeToQbo`, `syncTimeEntryToQbo`, `syncExpenseToQbo`,
  `syncCreditMemoToQbo`, `resolveOrCreateQboClass`, `fetchAndCachePreferences`
- Retrofit `syncInvoiceToQbo` and `syncQuoteToQbo` with ClassRef support
- `qbo-flush/route.ts`: 5 new dispatcher cases

### Wave 3 — API Routes + Trigger Points (depend on Wave 2 sync functions)

Deliverables:
- `src/app/api/vendors/` — full CRUD (5 routes)
- `src/app/api/invoices/[id]/credit/route.ts` — credit memo trigger
- Auto-enqueue additions to: StockMovement creation route, TimeEntry PATCH route
- `sync-trigger/route.ts` — extend to support "vendors" and "employees" entity types
- `qbo-cdc/route.ts` — add `fetchAndCachePreferences()` call in `pollOrgCdc`

### Wave 4 — UI + Tests (depend on Wave 3 routes)

Deliverables:
- QBO Health dashboard — class tracking disabled banner
- Invoice detail — "Issue Credit" button + ConfirmDialog
- Unit tests: mapper functions (toQboEmployee, toQboVendor, toQboTimeActivity, toQboBill,
  toQboPurchase, toQboCreditMemo)
- Unit tests: sync functions (syncVendorToQbo, syncEmployeeToQbo, syncTimeEntryToQbo,
  syncExpenseToQbo, syncCreditMemoToQbo)
- Unit tests: resolveOrCreateQboClass (class tracking enabled/disabled, auto-create, cache hit)
- Unit tests: flush dispatcher new cases
- Unit tests: fetchAndCachePreferences

---

## 12. Open Design Questions for Planner

These items were flagged as requiring a decision before writing the PLAN.md files:

**Q1: Purchase AccountRef (payment account)**
The QBO Purchase entity's top-level `AccountRef` is the payment method account (Checking, Credit
Card, etc.) — distinct from the expense category. Options:
- (a) Add a 6th account mapping category: `expense_payment_account` (Checking by default)
- (b) Use `queryEntities` to find the first active Checking account on first use and cache it
- (c) Use the existing `job_cost_expense` account as a fallback (incorrect, but unblocking)
Recommended: Option (a) — add `expense_payment_account` as a 6th mapping category. Extend the
account mapping UI with a new row.

**Q2: Invoice qboCreditMemoId field**
Need to add `qboCreditMemoId String?` to the `Invoice` model to track credit memo sync state.
This is a Wave 1 schema addition.

**Q3: Invoice credit trigger vs status**
Manual "Issue Credit" button is recommended (see section 5.5). The plan should confirm whether to
add a `hasCreditMemo Boolean @default(false)` flag on Invoice to prevent duplicate credit memos.

**Q4: Time entry total seconds calculation**
The `TimeEntry.accumulatedSeconds` field stores accumulated time from completed pause/resume cycles.
For a `STOPPED` entry: confirm whether `accumulatedSeconds` is the complete total, or whether the
final segment duration (from last resume to stop) needs to be added separately. The mobile app
stores the running total in `accumulatedSeconds` on stop. Need to verify the web/backend behavior.

**Q5: Class tracking at line level vs transaction level**
QBO supports both `ClassTrackingPerTxn` (one class per transaction) and `ClassTrackingPerTxnLine`
(one class per line). The `resolveOrCreateQboClass()` helper applies class at the transaction level
(top-level `ClassRef` on Invoice/Bill/TimeActivity). If the QBO company uses per-line tracking, the
class must be applied to each line's detail. DIM-03 Preferences check should verify which mode is
active. For MVP, recommend transaction-level only (simpler, covers 90% of use cases).

---

## 13. Validation Architecture — Testable Verification Criteria

### VEND-01: Vendor Sync
- [ ] `syncVendorToQbo("org-1", "vendor-1")` → returns `{ success: true, qboVendorId: "qbo-v-1" }`
- [ ] Re-running sync when `qboVendorId` already set → calls `updateVendor` not `createVendor`
- [ ] `resolveOrCreateQboEntity` called with Vendor email matching → links existing, skips create
- [ ] `Vendor.qboVendorId` updated in DB after successful sync
- [ ] `QboSyncLog` row created with `entityType: "vendor"`, `status: "success"`
- [ ] Failure path: `QboSyncLog` row with `status: "failed"`, `errorMessage` set

### TIME-01: Employee Sync
- [ ] `syncEmployeeToQbo("org-1", "user-tech-1")` → returns `{ success: true, qboEmployeeId: "qbo-e-1" }`
- [ ] `role !== "TECH"` guard: returns `{ success: false, error: "Only TECH users..." }`
- [ ] `User.qboEmployeeId` updated in DB after sync
- [ ] DisplayName fallback: null `user.name` → email prefix used

### TIME-02: Time Activity Sync
- [ ] `syncTimeEntryToQbo("org-1", "te-1")` with STOPPED entry → creates `QboTimeActivity`
- [ ] Non-STOPPED entry guard → returns error without creating QBO entity
- [ ] Cascade: null `user.qboEmployeeId` triggers `syncEmployeeToQbo` before proceeding
- [ ] Cascade: null `customer.qboCustomerId` triggers `syncCustomerToQbo` before proceeding
- [ ] PM-generated work order → `BillableStatus: "NotBillable"` in QBO payload
- [ ] `TimeEntry.qboTimeActivityId` updated in DB after sync
- [ ] Class tracking enabled: `ClassRef` present in payload
- [ ] Class tracking disabled: `ClassRef` absent from payload (no error thrown)

### EXP-01: Expense/Bill Sync
- [ ] StockMovement PURCHASE + vendorId set → creates QBO `Bill` (not `Purchase`)
- [ ] StockMovement PURCHASE + no vendorId → creates QBO `Purchase`
- [ ] Non-PURCHASE movement type → returns error, no QBO entity created
- [ ] Vendor cascade: null `qboVendorId` triggers `syncVendorToQbo` before Bill creation
- [ ] Account mapping gate: incomplete mapping → returns descriptive error
- [ ] `StockMovement.qboBillId` or `qboPurchaseId` set after successful sync
- [ ] Subcontractor vendor → uses `subcontractor_expense` account mapping category

### QUOT-03: Credit Memo
- [ ] `syncCreditMemoToQbo("org-1", "inv-1")` with `qboInvoiceId` set → creates `QboCreditMemo`
- [ ] Missing `qboInvoiceId` guard → returns error "Invoice not synced to QBO"
- [ ] `LinkedTxn` in QBO payload references original invoice ID
- [ ] `Invoice.qboCreditMemoId` updated after sync

### DIM-01: Class Tracking
- [ ] `resolveOrCreateQboClass(conn, "org-1", "WORK_ORDER")` with class tracking enabled, no cache → creates "Work Order" class in QBO, upserts `QboClassMap`
- [ ] Second call with same orderType → returns cached `QboClassMap` entry, no QBO API call
- [ ] Class tracking disabled on connection → returns `null`, no QBO API call
- [ ] Any class tracking failure → returns `null` (does not throw), sync proceeds without ClassRef

### DIM-03: Preferences Check
- [ ] `fetchAndCachePreferences(connection)` → updates `QboConnection.classTrackingEnabled`
- [ ] `classTrackingEnabled = true` set correctly from `AccountingInfoPrefs.ClassTrackingPerTxn`
- [ ] Called from CDC cron every 4 hours (skipped if `preferencesLastCheckedAt < 23h ago`)
- [ ] QBO Health dashboard shows yellow banner when `classTrackingEnabled === false`

### Flush Dispatcher
- [ ] `vendor:push` job → dispatches to `syncVendorToQbo`
- [ ] `employee:push` job → dispatches to `syncEmployeeToQbo`
- [ ] `timeActivity:push` job → dispatches to `syncTimeEntryToQbo`
- [ ] `expense:push` job → dispatches to `syncExpenseToQbo`
- [ ] `creditMemo:push` job → dispatches to `syncCreditMemoToQbo`

---

## 14. Files to Create or Modify

### New Files
- `src/app/api/vendors/route.ts` — list + create
- `src/app/api/vendors/[id]/route.ts` — get + update + delete
- `src/app/api/invoices/[id]/credit/route.ts` — credit memo trigger
- `src/__tests__/lib/qbo/phase5-mappers.test.ts` — mapper unit tests
- `src/__tests__/lib/qbo/phase5-sync.test.ts` — sync function unit tests
- `src/__tests__/lib/qbo/phase5-flush.test.ts` — flush dispatcher tests

### Modified Files
- `prisma/schema.prisma` — Vendor model, QboClassMap model, field additions to User, Material, StockMovement, QboConnection, Invoice, Org
- `src/lib/qbo/qbo-client.ts` — 16 new functions, extended type imports/exports
- `src/lib/qbo/qbo-mapper.ts` — 6 new pure mapper functions
- `src/lib/qbo/qbo-sync.ts` — 5 new sync functions + 2 helpers, retrofit syncInvoiceToQbo + syncQuoteToQbo
- `src/app/api/cron/qbo-flush/route.ts` — 5 new dispatcher cases + import additions
- `src/app/api/cron/qbo-cdc/route.ts` — add `fetchAndCachePreferences` call in pollOrgCdc
- `src/app/api/integrations/qbo/sync-trigger/route.ts` — extend entityType options
- `src/app/(app)/settings/integrations/qbo-health/page.tsx` — class tracking banner
- `src/app/(app)/invoices/[id]/page.tsx` — "Issue Credit" button

---

*Phase: 05-enterprise-outbound*
*Research written: 2026-03-09*
*Source files read: qbo-client.ts (675 lines), qbo-types.ts (562 lines), qbo-sync.ts (1,234 lines), qbo-mapper.ts (277 lines), qbo-queue.ts (224 lines), qbo-flush/route.ts (144 lines), schema.prisma (1,800+ lines), 05-CONTEXT.md, REQUIREMENTS.md, STATE.md*
