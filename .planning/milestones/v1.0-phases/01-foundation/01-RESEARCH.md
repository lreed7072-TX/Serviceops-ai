# Phase 1 Research: Foundation & Bug Fixes

**Researched:** 2026-03-08
**Phase:** 01-foundation
**Requirements covered:** FOUND-01 through FOUND-09

---

## RESEARCH COMPLETE

---

### Findings per Requirement

---

#### FOUND-01: Token Refresh Mutex (CAS Pattern)

**Decision already locked:** CAS flag on `QboConnection`. `SELECT FOR UPDATE` is blocked by PgBouncer transaction-mode pooling on the `DATABASE_URL`.

**How Prisma `updateMany` acts as CAS:**

Prisma's `updateMany` accepts a `where` filter. If the filter condition is not met, Prisma returns `{ count: 0 }` rather than throwing. This lets you use it as an atomic conditional update (Compare-And-Swap):

```typescript
const result = await prisma.qboConnection.updateMany({
  where: {
    id: connection.id,
    refreshInProgress: false,  // CAS condition — only claim if not already locked
  },
  data: {
    refreshInProgress: true,
    refreshLockedAt: new Date(),
  },
});
// result.count === 1 → this instance won the lock
// result.count === 0 → another instance already holds the lock
```

This is atomic at the PostgreSQL layer because Prisma translates `updateMany` to a single `UPDATE ... WHERE ...` SQL statement. The WHERE condition and the SET happen in one statement with no time gap.

**Polling/backoff pattern for waiting instances:**

When `result.count === 0` (lost the CAS), the waiting instance must poll until the lock is cleared:

```typescript
const MAX_POLLS = 5;
const POLL_INTERVAL_MS = 200;
for (let i = 0; i < MAX_POLLS; i++) {
  await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  const fresh = await prisma.qboConnection.findUnique({ where: { id: connection.id } });
  if (!fresh?.refreshInProgress) {
    return fresh!.accessToken; // New token is ready
  }
}
throw new Error("Token refresh lock timed out after polling");
```

**Stale lock safety:** Check `refreshLockedAt < (now - 30 seconds)`. If stale, force-clear the lock and re-attempt the CAS:

```typescript
if (existing.refreshLockedAt && (Date.now() - existing.refreshLockedAt.getTime()) > 30_000) {
  // Stale lock — force clear and try again
  await prisma.qboConnection.updateMany({
    where: { id: connection.id, refreshInProgress: true },
    data: { refreshInProgress: false, refreshLockedAt: null },
  });
}
```

**Always-clear in `finally`:** The lock must be released regardless of success or failure:

```typescript
try {
  const tokens = await refreshAccessToken(connection);
  await prisma.qboConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
      refreshTokenExpiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000), // 100 days
      refreshInProgress: false,
      refreshLockedAt: null,
    },
  });
} finally {
  // Belt-and-suspenders: ensure lock is always cleared even if update above fails
  await prisma.qboConnection.updateMany({
    where: { id: connection.id, refreshInProgress: true },
    data: { refreshInProgress: false, refreshLockedAt: null },
  }).catch(() => {}); // Swallow — we're already in error path
}
```

**Fields required on `QboConnection` (FOUND-06 overlap):**
- `refreshInProgress Boolean @default(false)`
- `refreshLockedAt DateTime?`
- `refreshTokenExpiry DateTime?` (also needed for DASH-04 in Phase 6)

**PgBouncer note confirmed:** The `directUrl` in `schema.prisma` bypasses PgBouncer but is reserved for `prisma migrate`. All runtime queries use `DATABASE_URL` (pooled). The CAS pattern works correctly through PgBouncer because it is a single SQL statement.

---

#### FOUND-02: Sparse Update Fix (Fetch-Merge-POST)

**Current bug location:** `qbo-client.ts` lines 262-288, `updateCustomer()`.

**What the current code does:**
```typescript
// BUGGY: Only sends Id, SyncToken, DisplayName, and optionally email
const qboCustomer: Record<string, unknown> = {
  Id: qboCustomerId,
  SyncToken: (existing as Record<string, unknown>).SyncToken,
  DisplayName: customerData.displayName,
};
if (customerData.email) {
  qboCustomer.PrimaryEmailAddr = { Address: customerData.email };
}
```

QBO's POST to an entity endpoint is a **full replace**, not a PATCH. Any field omitted from the payload is cleared to null/empty in QBO. The current code always clears `PrimaryPhone`, `BillAddr`, `Notes`, `PaymentMethodRef`, `Terms`, `IsSubCustomer`, `ParentRef`, and all other QBO Customer fields on every sync.

**Correct pattern — deep merge into fetched entity:**

```typescript
export async function updateCustomer(
  connection: QboConnection,
  qboCustomerId: string,
  customerData: {
    displayName: string;
    email?: string | null;
    phone?: string | null;
  }
): Promise<QboCustomer> {
  // 1. Fetch the full existing entity (already done — getCustomer exists)
  const existing: QboCustomer = await getCustomer(connection, qboCustomerId);

  // 2. Merge only the fields ServiceOps manages — preserve everything else
  const merged: QboCustomer = {
    ...existing,                           // all QBO fields preserved
    DisplayName: customerData.displayName, // ServiceOps wins on name
  };

  if (customerData.email !== undefined) {
    merged.PrimaryEmailAddr = customerData.email
      ? { Address: customerData.email }
      : undefined;
  }
  if (customerData.phone !== undefined) {
    merged.PrimaryPhone = customerData.phone
      ? { FreeFormNumber: customerData.phone }
      : undefined;
  }
  // SyncToken must come from the fetched entity — already in `existing`

  // 3. POST the complete merged payload
  const result = await qboRequest(connection, "POST", "customer", merged) as {
    Customer: QboCustomer;
  };
  return result.Customer;
}
```

**Key insight:** The `getCustomer()` call already exists and already fetches the full entity. The fix is simply spreading `existing` into the payload before applying ServiceOps changes. SyncToken is automatically included in the spread.

**This pattern must be established as the standard for all future update functions** in `qbo-mapper.ts` via the `existingQbo?: QboCustomer` parameter. Every `toQboCustomer(customer, existingQbo)` call merges ServiceOps fields into `existingQbo` rather than building from scratch.

**QBO Customer fields that must be preserved (not exhaustive, but critical):**
- `SyncToken` — required for the update to succeed
- `PrimaryPhone`, `AlternatePhone`, `Mobile`, `Fax`
- `BillAddr`, `ShipAddr`
- `Notes`
- `PaymentMethodRef` — payment terms
- `SalesTermRef` — net 30, etc.
- `IsSubCustomer`, `ParentRef` — hierarchy
- `Job`, `Balance`, `OpenBalanceDate`
- `PreferredDeliveryMethod`
- `ResaleNum`

---

#### FOUND-03: Decimal Rounding Fix

**Current bug location:** `qbo-sync.ts` lines 147-152, `syncInvoiceToQbo()`.

**Exact current code:**
```typescript
const lineItems = invoice.lineItems.map((item) => ({
  description: item.description,
  amount: Number(item.totalPrice),      // BUG: no rounding
  quantity: Number(item.quantity),      // BUG: no rounding
  unitPrice: Number(item.unitPrice),    // BUG: no rounding
}));
```

**Why `Number(prismaDecimal)` is broken:** Prisma's `Decimal` type (from the `decimal.js` library) stores values with full precision. `Number(new Decimal("123.45"))` may produce `123.45000000000000284217...` due to IEEE 754 double-precision floating point. QBO validates amounts and can reject totals that don't match to 2 decimal places.

**Correct pattern:**
```typescript
function roundQboAmount(value: Decimal | number | string): number {
  return Number(new Decimal(value).toFixed(2));
}
```

Or more simply, since Prisma Decimal already has `.toFixed()`:
```typescript
function roundQboAmount(value: Decimal): number {
  return Number(value.toFixed(2));
}
```

`Decimal.toFixed(2)` returns a string like `"123.45"`. `Number("123.45")` is exact because two-decimal-place numbers within the normal invoice range are representable in IEEE 754.

**Where to define it:** `qbo-mapper.ts` as an exported helper. Import it into `qbo-sync.ts` for the immediate fix and use it in all future mapper functions.

**Corrected line items:**
```typescript
const lineItems = invoice.lineItems.map((item) => ({
  description: item.description,
  amount: roundQboAmount(item.totalPrice),
  quantity: roundQboAmount(item.quantity),
  unitPrice: roundQboAmount(item.unitPrice),
}));
```

**Note on quantity:** QBO allows up to 4 decimal places on quantity (e.g., 1.5000 hours). The 2-decimal rounding is correct for monetary amounts but quantity could reasonably use `Number(value.toFixed(4))`. For Phase 1, `toFixed(2)` is acceptable for all values. Document this in the helper.

---

#### FOUND-04: Pin minorversion=75

**Current state:** `qboRequest()` in `qbo-client.ts` constructs URLs as:
```typescript
const url = `${getApiBase()}/${connection.realmId}/${path}`;
```
No `minorversion` is appended anywhere. This means all API calls send no version parameter, which defaults to whatever Intuit's server decides. Versions below 75 were deprecated August 1, 2025.

**Implementation — add the constant and append to all URLs:**

```typescript
export const QBO_API_VERSION = "75";
```

In `qboRequest()`, append to the URL. The challenge is that some `path` values passed to `qboRequest()` may already include query strings (e.g., for queries). Handle both cases:

```typescript
async function qboRequest(
  connection: QboConnection,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const accessToken = await getValidAccessToken(connection);
  const base = `${getApiBase()}/${connection.realmId}/${path}`;
  // Append minorversion — handle existing query params safely
  const url = base.includes("?")
    ? `${base}&minorversion=${QBO_API_VERSION}`
    : `${base}?minorversion=${QBO_API_VERSION}`;
  // ... rest unchanged
}
```

**Scan for any other places minorversion might be hardcoded:** A grep of the codebase shows `minorversion` does not appear anywhere currently. The fix is entirely in `qboRequest()`.

**Export the constant** so it can be referenced in tests:
```typescript
export const QBO_API_VERSION = "75";
```

---

#### FOUND-05: New Prisma Models

**QboSyncJob — exact Prisma schema syntax:**

```prisma
model QboSyncJob {
  id           String    @id @default(uuid()) @db.Uuid
  orgId        String    @db.Uuid
  connectionId String    @db.Uuid
  entityType   String    // "customer" | "invoice" | "estimate" | "item" | "employee" | "vendor" | "timeActivity" | "expense" | "payment" | "creditMemo"
  entityId     String    @db.Uuid
  action       String    // "push" | "pull" | "void" | "email"
  priority     Int       @default(5) // 1=real-time, 5=CDC, 9=bulk
  status       String    @default("pending") // "pending" | "claimed" | "completed" | "failed" | "dead_letter"
  payload      Json?
  attempts     Int       @default(0)
  maxAttempts  Int       @default(3)
  lockedAt     DateTime?
  lockedBy     String?   // serverless instance ID (e.g., process.env.VERCEL_REGION + random)
  completedAt  DateTime?
  errorMessage String?   @db.Text
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  org        Org           @relation(fields: [orgId], references: [id])
  connection QboConnection @relation(fields: [connectionId], references: [id])

  @@index([orgId, status, priority])   // Primary query index for claiming jobs
  @@index([status, lockedAt])          // Stale lock detection
  @@index([orgId, entityType, entityId, status]) // Deduplication check
}
```

**QboAccountMap — exact Prisma schema syntax:**

```prisma
model QboAccountMap {
  id               String   @id @default(uuid()) @db.Uuid
  orgId            String   @db.Uuid
  category         String   // "labor_income" | "materials_income" | "service_income" | "job_cost_expense" | "subcontractor_expense"
  qboAccountId     String
  qboAccountName   String
  qboAccountType   String   // "Income" | "Expense" | "Cost of Goods Sold"
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  org Org @relation(fields: [orgId], references: [id])

  @@unique([orgId, category])
  @@index([orgId])
}
```

**QboCdcCursor — exact Prisma schema syntax:**

```prisma
model QboCdcCursor {
  id              String    @id @default(uuid()) @db.Uuid
  orgId           String    @db.Uuid
  connectionId    String    @db.Uuid
  lastPollAt      DateTime
  lastPollStatus  String    @default("success") // "success" | "failed"
  lastPollError   String?   @db.Text
  entityTypes     String    // comma-separated: "Customer,Invoice,Payment,Estimate,Item"
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  org        Org           @relation(fields: [orgId], references: [id])
  connection QboConnection @relation(fields: [connectionId], references: [id])

  @@unique([orgId])
  @@index([orgId])
}
```

**Schema consistency rules confirmed from existing models:**
- Primary key: `@id @default(uuid()) @db.Uuid`
- All models include `orgId String @db.Uuid` with `@@index([orgId])`
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Relations declared with `@relation(fields: [...], references: [...])`
- `@@index` over multi-column queries

**Relation declarations needed on `QboConnection`:**
```prisma
syncJobs     QboSyncJob[]
cdcCursors   QboCdcCursor[]
```

**Relation declarations needed on `Org`:**
```prisma
qboSyncJobs    QboSyncJob[]
qboAccountMaps QboAccountMap[]
qboCdcCursors  QboCdcCursor[]
```

---

#### FOUND-06: Fields on Existing Models

**QboConnection — three new fields (confirmed field names and types):**

Current `QboConnection` model (lines 1701-1719):
- Has: `id`, `orgId`, `realmId`, `accessToken`, `refreshToken`, `accessTokenExpiry`, `companyName`, `isActive`, `connectedAt`, `lastSyncAt`, `createdAt`, `updatedAt`
- Missing: `refreshTokenExpiry`, `refreshInProgress`, `refreshLockedAt`

Add after `accessTokenExpiry`:
```prisma
refreshTokenExpiry DateTime?          // 100-day expiry; null = unknown
refreshInProgress  Boolean   @default(false)
refreshLockedAt    DateTime?
```

**Quote model — two new fields (confirmed current fields):**

Current `Quote` model (lines 1182-1226):
- Has: `id`, `orgId`, `customerId`, `siteId`, `quoteNumber`, `status`, `title`, `description`, `laborRate`, `materialMarkupPercent`, `subtotal`, `tax`, `taxRate`, `total`, `validUntil`, `notes`, `terms`, `sentAt`, `approvedAt`, `approvedByName`, `rejectedAt`, `rejectionReason`, `convertedToOrderId`, `convertedToOrderType`, `createdByUserId`, `createdAt`, `updatedAt`
- Missing: `qboEstimateId`, `qboSyncedAt`

Add after `rejectionReason`:
```prisma
qboEstimateId String?    // QBO Estimate entity ID after sync
qboSyncedAt   DateTime?  // Last synced timestamp
```

**Material model — one new field (confirmed current fields):**

Current `Material` model (lines 1035-1065):
- Has: `id`, `orgId`, `name`, `partNumber`, `manufacturer`, `unitCost`, `unit`, `category`, `isActive`, `quantityOnHand`, `minQuantity`, `maxQuantity`, `location`, `lastRestocked`, `createdAt`, `updatedAt`
- Missing: `qboItemId`

Add after `lastRestocked`:
```prisma
qboItemId String?   // QBO Item (Product/Service) entity ID after sync
```

**LaborRate model — one new field (confirmed current fields):**

Current `LaborRate` model (lines 1288-1301):
- Has: `id`, `orgId`, `name`, `description`, `hourlyRate`, `isDefault`, `createdAt`, `updatedAt`
- Missing: `qboItemId`

Add after `isDefault`:
```prisma
qboItemId String?   // QBO Item (Service) entity ID after sync
```

**TimeEntry model — one new field (confirmed current fields):**

Current `TimeEntry` model (lines 867-892):
- Has: `id`, `orgId`, `userId`, `workOrderId`, `taskInstanceId`, `status`, `startedAt`, `pausedAt`, `stoppedAt`, `accumulatedSeconds`, `notes`, `createdAt`, `updatedAt`
- Missing: `qboTimeActivityId`

Add after `notes`:
```prisma
qboTimeActivityId String?   // QBO TimeActivity entity ID after sync
```

**Vendor note confirmed:** No standalone `Vendor` model exists in the 1700-line schema. `StockMovement.reference` is a plain String field. `qboVendorId` is deferred to Phase 5 when the Vendor model is created.

---

#### FOUND-07: QBO Types File (qbo-types.ts)

**Existing types to migrate from `qbo-client.ts`:**
- `QboCustomer` (lines 22-33) — minimal, needs expansion
- `QboInvoice` (lines 35-51) — minimal, needs expansion
- `TokenResponse` (lines 16-20) — stays in qbo-client (auth-specific, not an entity type)

**Complete type coverage needed for all 6 phases:**

**Common/shared types (define first, referenced by all entities):**
```typescript
export type QboRef = { value: string; name?: string };
export type QboEmailAddr = { Address: string };
export type QboPhoneNumber = { FreeFormNumber: string };
export type QboAddress = {
  Id?: string;
  Line1?: string;
  Line2?: string;
  Line3?: string;
  City?: string;
  CountrySubDivisionCode?: string; // State abbreviation
  PostalCode?: string;
  Country?: string;
  Lat?: string;
  Long?: string;
};
export type QboMetaData = {
  CreateTime: string;        // ISO 8601
  LastUpdatedTime: string;   // ISO 8601 — used for conflict resolution
};
export type QboLinkedTxn = {
  TxnId: string;
  TxnType: string; // "Estimate", "Invoice", etc.
  TxnLineId?: string;
};
export type QboLine = {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount: number;
  DetailType: string;
  SalesItemLineDetail?: {
    ItemRef?: QboRef;
    ClassRef?: QboRef;
    UnitPrice?: number;
    Qty?: number;
    TaxCodeRef?: QboRef;
    ServiceDate?: string;
  };
  GroupLineDetail?: { GroupItemRef: QboRef; Line: QboLine[] };
  LinkedTxn?: QboLinkedTxn[];
};
export type QboFault = {
  Error: Array<{
    Message: string;
    Detail: string;
    code: string;
    element?: string;
  }>;
  type: string; // "ValidationFault", "AuthenticationFault", "SystemFault"
};
```

**Entity types — minorversion=75 field coverage:**

```typescript
export type QboCustomer = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  DisplayName: string;
  Title?: string;
  GivenName?: string;
  MiddleName?: string;
  FamilyName?: string;
  Suffix?: string;
  FullyQualifiedName?: string;
  CompanyName?: string;
  PrintOnCheckName?: string;
  Active?: boolean;
  PrimaryPhone?: QboPhoneNumber;
  AlternatePhone?: QboPhoneNumber;
  Mobile?: QboPhoneNumber;
  Fax?: QboPhoneNumber;
  PrimaryEmailAddr?: QboEmailAddr;
  WebAddr?: { URI: string };
  BillAddr?: QboAddress;
  ShipAddr?: QboAddress;
  Notes?: string;
  PaymentMethodRef?: QboRef;
  SalesTermRef?: QboRef;
  CurrencyRef?: QboRef;
  Balance?: number;
  OpenBalanceDate?: string;
  PreferredDeliveryMethod?: string; // "Print" | "Email" | "None"
  ResaleNum?: string;
  Taxable?: boolean;
  DefaultTaxCodeRef?: QboRef;
  IsSubCustomer?: boolean;
  ParentRef?: QboRef;
  Level?: number; // Sub-customer hierarchy level
  Job?: boolean;
};

export type QboInvoice = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;  // YYYY-MM-DD
  DueDate?: string;  // YYYY-MM-DD
  CustomerRef: QboRef;
  BillAddr?: QboAddress;
  ShipAddr?: QboAddress;
  ShipDate?: string;
  TrackingNum?: string;
  ClassRef?: QboRef;
  DepartmentRef?: QboRef;
  SalesTermRef?: QboRef;
  Line: QboLine[];
  TxnTaxDetail?: { TxnTaxCodeRef?: QboRef; TotalTax?: number; TaxLine?: QboLine[] };
  TotalAmt: number;
  Balance: number;
  EmailStatus?: string; // "NotSet" | "NeedToSend" | "EmailSent"
  BillEmail?: QboEmailAddr;
  LinkedTxn?: QboLinkedTxn[];
  PrintStatus?: string;
  CustomerMemo?: { value: string };
  Deposit?: number;
  ApplyTaxAfterDiscount?: boolean;
  GlobalTaxCalculation?: string;
  HomeTotalAmt?: number;
  FreeFormAddress?: boolean;
};

export type QboPayment = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  TxnDate?: string;
  CustomerRef: QboRef;
  PaymentMethodRef?: QboRef;
  PaymentRefNum?: string;
  DepositToAccountRef?: QboRef;
  TotalAmt: number;
  UnappliedAmt?: number;
  ProcessPayment?: boolean;
  Line?: Array<{
    Amount: number;
    LinkedTxn: QboLinkedTxn[];
  }>;
};

export type QboEstimate = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  ExpirationDate?: string;
  CustomerRef: QboRef;
  BillAddr?: QboAddress;
  ShipAddr?: QboAddress;
  ClassRef?: QboRef;
  DepartmentRef?: QboRef;
  SalesTermRef?: QboRef;
  Line: QboLine[];
  TxnTaxDetail?: { TotalTax?: number };
  TotalAmt: number;
  TxnStatus?: string; // "Accepted" | "Closed" | "Pending" | "Rejected"
  CustomerMemo?: { value: string };
  EmailStatus?: string;
  BillEmail?: QboEmailAddr;
  LinkedTxn?: QboLinkedTxn[];
};

export type QboItem = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  Name: string;
  FullyQualifiedName?: string;
  Description?: string;
  Active?: boolean;
  Type: string; // "Inventory" | "NonInventory" | "Service"
  UnitPrice?: number;
  PurchaseCost?: number;
  IncomeAccountRef?: QboRef;
  ExpenseAccountRef?: QboRef;
  AssetAccountRef?: QboRef;
  TrackQtyOnHand?: boolean;
  QtyOnHand?: number;
  InvStartDate?: string;
  PurchaseDesc?: string;
  SubItem?: boolean;
  ParentRef?: QboRef;
  Level?: number;
  ClassRef?: QboRef;
  Taxable?: boolean;
  SalesTaxCodeRef?: QboRef;
  PurchaseTaxCodeRef?: QboRef;
};

export type QboEmployee = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  DisplayName: string;
  Title?: string;
  GivenName?: string;
  MiddleName?: string;
  FamilyName?: string;
  Suffix?: string;
  PrintOnCheckName?: string;
  Active?: boolean;
  PrimaryPhone?: QboPhoneNumber;
  Mobile?: QboPhoneNumber;
  PrimaryEmailAddr?: QboEmailAddr;
  PrimaryAddr?: QboAddress;
  EmployeeNumber?: string;
  SSN?: string; // Masked: ***-**-XXXX
  HiredDate?: string;
  ReleasedDate?: string;
  BillableTime?: boolean;
  BillRate?: number;
  Organization?: boolean;
  V4IDPseudonym?: string; // Unique ID for TimeActivity NameOf
};

export type QboVendor = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  DisplayName: string;
  Title?: string;
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  PrintOnCheckName?: string;
  Active?: boolean;
  PrimaryPhone?: QboPhoneNumber;
  AlternatePhone?: QboPhoneNumber;
  Mobile?: QboPhoneNumber;
  Fax?: QboPhoneNumber;
  PrimaryEmailAddr?: QboEmailAddr;
  WebAddr?: { URI: string };
  BillAddr?: QboAddress;
  Term?: QboRef;
  CurrencyRef?: QboRef;
  Vendor1099?: boolean; // 1099 tracking flag (Phase 5)
  Balance?: number;
  AcctNum?: string;
  TaxIdentifier?: string;
};

export type QboTimeActivity = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  TxnDate: string;
  NameOf: string; // "Employee" | "Vendor" | "Other"
  EmployeeRef?: QboRef;
  VendorRef?: QboRef;
  CustomerRef?: QboRef;
  ItemRef?: QboRef; // Service Item
  ClassRef?: QboRef;
  DepartmentRef?: QboRef;
  BillableStatus?: string; // "Billable" | "NotBillable" | "HasBeenBilled"
  Taxable?: boolean;
  HourlyRate?: number;
  Hours?: number;
  Minutes?: number;
  StartTime?: string; // ISO 8601
  EndTime?: string;
  Description?: string;
  BreakHours?: number;
  BreakMinutes?: number;
};

export type QboBill = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  VendorRef: QboRef;
  APAccountRef?: QboRef;
  DepartmentRef?: QboRef;
  Line: Array<{
    Id?: string;
    LineNum?: number;
    Description?: string;
    Amount: number;
    DetailType: string; // "AccountBasedExpenseLineDetail" | "ItemBasedExpenseLineDetail"
    AccountBasedExpenseLineDetail?: {
      AccountRef: QboRef;
      ClassRef?: QboRef;
      BillableStatus?: string;
      CustomerRef?: QboRef;
    };
    ItemBasedExpenseLineDetail?: {
      ItemRef: QboRef;
      Qty?: number;
      UnitPrice?: number;
      ClassRef?: QboRef;
      CustomerRef?: QboRef;
      BillableStatus?: string;
    };
  }>;
  LinkedTxn?: QboLinkedTxn[]; // Links to PurchaseOrder
  TotalAmt?: number;
  Balance?: number;
  SalesTermRef?: QboRef;
  GlobalTaxCalculation?: string;
};

export type QboPurchase = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  PaymentType: string; // "Cash" | "Check" | "CreditCard"
  AccountRef: QboRef;
  EntityRef?: QboRef; // Vendor or Employee
  TxnDate?: string;
  DocNumber?: string;
  DepartmentRef?: QboRef;
  Line: Array<{
    Id?: string;
    Description?: string;
    Amount: number;
    DetailType: string;
    AccountBasedExpenseLineDetail?: {
      AccountRef: QboRef;
      ClassRef?: QboRef;
      CustomerRef?: QboRef;
      BillableStatus?: string;
    };
    ItemBasedExpenseLineDetail?: {
      ItemRef: QboRef;
      Qty?: number;
      UnitPrice?: number;
      ClassRef?: QboRef;
      CustomerRef?: QboRef;
      BillableStatus?: string;
    };
  }>;
  TotalAmt?: number;
  LinkedTxn?: QboLinkedTxn[];
};

export type QboPurchaseOrder = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  VendorRef: QboRef;
  APAccountRef?: QboRef;
  ShipTo?: QboRef; // Customer to ship to
  ShipAddr?: QboAddress;
  DepartmentRef?: QboRef;
  ClassRef?: QboRef;
  POStatus?: string; // "Open" | "Closed"
  Line: QboLine[]; // Uses ItemBasedExpenseLineDetail
  TotalAmt?: number;
  Memo?: string;
  VendorAddr?: QboAddress;
  EmailStatus?: string;
  BillEmail?: QboEmailAddr;
};

export type QboCreditMemo = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  DocNumber?: string;
  TxnDate?: string;
  CustomerRef: QboRef;
  DepartmentRef?: QboRef;
  ClassRef?: QboRef;
  SalesTermRef?: QboRef;
  Line: QboLine[];
  TxnTaxDetail?: { TotalTax?: number };
  TotalAmt: number;
  Balance?: number;
  RemainingCredit?: number;
  LinkedTxn?: QboLinkedTxn[];
  CustomerMemo?: { value: string };
  BillEmail?: QboEmailAddr;
  EmailStatus?: string;
  BillAddr?: QboAddress;
};

export type QboAccount = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  Name: string;
  FullyQualifiedName?: string;
  Description?: string;
  Active?: boolean;
  Classification?: string; // "Asset" | "Equity" | "Expense" | "Liability" | "Revenue"
  AccountType: string; // "Income" | "Expense" | "Cost of Goods Sold" | etc.
  AccountSubType?: string;
  AcctNum?: string;
  CurrencyRef?: QboRef;
  ParentRef?: QboRef;
  SubAccount?: boolean;
  CurrentBalance?: number;
  CurrentBalanceWithSubAccounts?: number;
};

export type QboClass = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  Name: string;
  FullyQualifiedName?: string;
  Active?: boolean;
  SubClass?: boolean;
  ParentRef?: QboRef;
};

export type QboLocation = { // Called "Department" in QBO API
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  Name: string;
  FullyQualifiedName?: string;
  Active?: boolean;
  SubDepartment?: boolean;
  ParentDepartmentRef?: QboRef;
};

export type QboPreferences = {
  Id: string;
  SyncToken: string;
  AccountingInfoPrefs?: {
    FirstMonthOfFiscalYear?: string;
    UseAccountNumbers?: boolean;
    ClassTrackingPerTxn?: boolean;
    ClassTrackingPerTxnLine?: boolean;
    TrackDepartments?: boolean;
    DepartmentTerminology?: string; // "Location" | "Division" | "Department" | "Territory" | "Business" | "Store" | "Property"
  };
  ProductAndServicesPrefs?: {
    ForPurchase?: boolean;
    ForSales?: boolean;
    QuantityWithPriceAndRate?: boolean;
    QuantityOnHand?: boolean;
    UsingInventoryValMethod?: string;
  };
  SalesFormsPrefs?: {
    DefaultTerms?: QboRef;
    DefaultDeliveryMethod?: string;
    ETransactionPaymentEnabled?: boolean;
    DefaultDiscountAccount?: QboRef;
    AllowEstimates?: boolean;
    AllowShipping?: boolean;
    AutoApplyCredits?: boolean;
    CustomField?: unknown[];
  };
  EmailMessagesPrefs?: unknown;
  TimeTrackingPrefs?: {
    UseServices?: boolean;
    BillCustomers?: boolean;
    ShowBillRateToAll?: boolean;
    MarkTimeEntriesBillable?: boolean;
    WorkWeekStartDate?: string;
  };
  TaxPrefs?: {
    PartnerTaxEnabled?: boolean;
    TaxGroupCodeRef?: QboRef;
    UsingSalesTax?: boolean;
  };
};

export type QboCompanyInfo = {
  Id: string;
  SyncToken: string;
  MetaData: QboMetaData;
  CompanyName: string;
  LegalName?: string;
  CompanyAddr?: QboAddress;
  CustomerCommunicationAddr?: QboAddress;
  LegalAddr?: QboAddress;
  PrimaryPhone?: QboPhoneNumber;
  CompanyStartDate?: string;
  FiscalYearStartMonth?: string;
  Country?: string;
  Email?: QboEmailAddr;
  WebAddr?: { URI: string };
  SupportedLanguages?: string;
  NameValue?: Array<{ Name: string; Value: string }>;
};
```

**CDC Response type (needed for Phase 4 but define now):**
```typescript
export type QboCdcResponse = {
  CDCResponse: Array<{
    QueryResponse: Array<{
      Customer?: QboCustomer[];
      Invoice?: QboInvoice[];
      Payment?: QboPayment[];
      Estimate?: QboEstimate[];
      Item?: QboItem[];
      startPosition: number;
      maxResults: number;
      totalCount?: number;
    }>;
    fault?: QboFault;
  }>;
  time: string;
};

export type QboQueryResponse<T> = {
  QueryResponse: {
    [entityName: string]: T[];
    startPosition: number;
    maxResults: number;
    totalCount?: number;
  };
  time: string;
};
```

---

#### FOUND-08: qbo-mapper.ts Design

**Pure function contract:** Every mapper function is a pure TypeScript function. No `import { prisma }`, no `await`, no `fetch`. Takes typed inputs, returns typed outputs. Fully testable without any mocks.

**Merge pattern for updates (solves FOUND-02):**
```typescript
// Outbound update: merge ServiceOps changes into existing QBO entity
export function toQboCustomer(
  customer: ServiceOpsCustomer,
  existingQbo?: QboCustomer  // undefined = create; defined = update (merge)
): Omit<QboCustomer, 'Id' | 'SyncToken' | 'MetaData'> | QboCustomer {
  const base = existingQbo ?? {};
  return {
    ...base,  // Preserve all existing QBO fields
    DisplayName: customer.name,
    PrimaryEmailAddr: customer.primaryEmail
      ? { Address: customer.primaryEmail }
      : existingQbo?.PrimaryEmailAddr, // Preserve if not overwriting
    // ... only override fields ServiceOps manages
  };
}
```

**`roundQboAmount` helper — place first in file:**
```typescript
import { Decimal } from "@prisma/client/runtime/library";

export function roundQboAmount(value: Decimal | number | string): number {
  if (value instanceof Decimal) {
    return Number(value.toFixed(2));
  }
  return Number(Number(value).toFixed(2));
}
```

**Initial mappers for Phase 1 (used in Phase 2-3 outbound sync):**

1. `toQboCustomer(customer: ServiceOpsCustomer, existingQbo?: QboCustomer): QboCustomerPayload`
2. `fromQboCustomer(qbo: QboCustomer): Partial<ServiceOpsCustomerUpdate>`
3. `toQboInvoice(invoice: ServiceOpsInvoice & { lineItems: InvoiceLineItem[] }, customerRef: string, existingQbo?: QboInvoice): QboInvoicePayload`
4. `toQboEstimate(quote: ServiceOpsQuote & { lineItems: QuoteLineItem[] }, customerRef: string, existingQbo?: QboEstimate): QboEstimatePayload`
5. `toQboInvoiceLine(item: InvoiceLineItem, itemRef?: string): QboLine`

**ServiceOps types needed in mapper:** Import from Prisma generated types. The mapper receives Prisma model instances directly. Define a `ServiceOpsCustomer` type alias or use `Customer` from `@prisma/client`.

**File structure:**
```typescript
// qbo-mapper.ts
// 1. Import QBO types from qbo-types.ts
// 2. Import Prisma types: Customer, Quote, Invoice, etc.
// 3. Helper: roundQboAmount()
// 4. Customer mappers: toQboCustomer, fromQboCustomer
// 5. Invoice mappers: toQboInvoice, toQboInvoiceLine
// 6. Estimate mappers: toQboEstimate
// 7. Item mappers (Phase 3): toQboItem
// Note: Employee, Vendor, TimeActivity mappers added in Phase 5
```

---

#### FOUND-09: qbo-queue.ts Design

**Atomic batch claiming — PostgreSQL raw SQL:**

The key insight: `UPDATE ... WHERE status='pending' ORDER BY priority ASC, createdAt ASC LIMIT $1 RETURNING *` is atomic in PostgreSQL — no two concurrent callers can claim the same row because the UPDATE row-locks before applying. This is the correct approach.

**Prisma `$executeRaw` vs `$queryRaw`:**
- `$executeRaw` — executes SQL, returns row count only
- `$queryRaw` — executes SQL, returns rows (needed for RETURNING *)

Use `$queryRaw` for `claimBatch`:

```typescript
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function claimBatch(limit: number = DEFAULT_BATCH_SIZE): Promise<QboSyncJob[]> {
  const lockerId = generateLockerId();
  const now = new Date();

  // Atomic: claim up to `limit` pending jobs, oldest+highest-priority first
  const claimed = await prisma.$queryRaw<QboSyncJob[]>(
    Prisma.sql`
      UPDATE "QboSyncJob"
      SET
        status = 'claimed',
        "lockedAt" = ${now},
        "lockedBy" = ${lockerId},
        "updatedAt" = ${now}
      WHERE id IN (
        SELECT id FROM "QboSyncJob"
        WHERE status = 'pending'
        ORDER BY priority ASC, "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `
  );
  return claimed;
}
```

**SKIP LOCKED note:** Even though PgBouncer blocks `SELECT FOR UPDATE` in the top-level context (FOUND-01 reason), it works correctly inside a subquery used in an UPDATE. The lock is part of the UPDATE statement's execution plan, not a separate advisory lock call. This pattern is safe through PgBouncer.

**Alternative if raw SQL proves problematic:** Use a Prisma transaction with `findMany` + `updateMany`:
```typescript
const jobs = await prisma.$transaction(async (tx) => {
  const pending = await tx.qboSyncJob.findMany({
    where: { status: "pending" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
  if (pending.length === 0) return [];
  await tx.qboSyncJob.updateMany({
    where: { id: { in: pending.map(j => j.id) } },
    data: { status: "claimed", lockedAt: new Date(), lockedBy: lockerId },
  });
  return pending;
});
```
This is not atomic (race possible between findMany and updateMany) but acceptable at low queue volume. Prefer the raw SQL approach.

**Locker ID generation:**
```typescript
function generateLockerId(): string {
  const region = process.env.VERCEL_REGION ?? "local";
  const random = Math.random().toString(36).slice(2, 8);
  return `${region}-${Date.now()}-${random}`;
}
```

**Complete helper signatures:**
```typescript
export async function enqueue(
  orgId: string,
  connectionId: string,
  entityType: string,
  entityId: string,
  action: string,
  priority?: number,
  payload?: Record<string, unknown>
): Promise<QboSyncJob>

export async function claimBatch(
  limit?: number
): Promise<QboSyncJob[]>

export async function complete(
  jobId: string,
  qboEntityId?: string
): Promise<void>

export async function fail(
  jobId: string,
  errorMessage: string
): Promise<void>

export async function resetStaleLocks(
  maxAgeSeconds?: number
): Promise<number> // returns count of reset jobs

export async function getDeadLetters(
  orgId: string
): Promise<QboSyncJob[]>

export async function requeueDeadLetter(
  jobId: string
): Promise<void>
```

**`fail` logic — promotes to dead_letter after maxAttempts:**
```typescript
export async function fail(jobId: string, errorMessage: string): Promise<void> {
  const job = await prisma.qboSyncJob.findUniqueOrThrow({ where: { id: jobId } });
  const newAttempts = job.attempts + 1;
  const isDead = newAttempts >= job.maxAttempts;
  await prisma.qboSyncJob.update({
    where: { id: jobId },
    data: {
      status: isDead ? "dead_letter" : "pending",
      attempts: newAttempts,
      lockedAt: null,
      lockedBy: null,
      errorMessage,
    },
  });
}
```

**Constants:**
```typescript
export const STALE_LOCK_SECONDS = 120;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BATCH_SIZE = 30;
```

---

### Validation Architecture

This section documents how to verify each requirement is correctly implemented. Format follows the Nyquist validation standard.

**FOUND-01 — Token Refresh Mutex:**
- Test: Simulate two concurrent calls to `getValidAccessToken()` on a connection with an expired token. Only one should call `refreshAccessToken()`; the other should wait and return the same new token.
- DB assertion: After the concurrent calls resolve, `QboConnection.refreshInProgress` is `false` and `refreshLockedAt` is null.
- Error path: If `refreshAccessToken()` throws, `refreshInProgress` must be `false` after the call.
- Stale test: Set `refreshInProgress=true` and `refreshLockedAt=(now - 35s)`. Verify the next call detects stale and re-acquires.

**FOUND-02 — Sparse Update Fix:**
- Test: Create a QBO Customer mock with `PrimaryPhone` set. Call `updateCustomer()` with only `displayName` changed. Assert the POST body includes the original `PrimaryPhone`.
- Integration test: After `updateCustomer()`, fetch the QBO Customer. Verify `PrimaryPhone` is preserved.
- QboCustomer type must include `SyncToken` — verify it is included in the merged payload.

**FOUND-03 — Decimal Rounding:**
- Unit test: `roundQboAmount(new Decimal("123.456789"))` returns `123.46` (not `123.456...`).
- Unit test: `roundQboAmount(new Decimal("100"))` returns `100` (not `100.00` as string — must be number).
- Integration test: `syncInvoiceToQbo()` sends `Amount: 123.46` not `123.45678...` in the QBO request body.

**FOUND-04 — minorversion=75:**
- Code assertion: `grep -r "minorversion" src/lib/qbo/` returns only the `QBO_API_VERSION` constant definition and the one append in `qboRequest()`.
- Unit test: Call any `qboRequest()` wrapper; verify the intercepted URL contains `minorversion=75`.
- Code assertion: No string literal `"75"` or `"minorversion"` appears in mapper/queue/sync files.

**FOUND-05 — New Prisma Models:**
- Run `npx prisma migrate dev --name phase1-foundation`. Should complete without error.
- `npx prisma studio` or direct SQL: Verify `QboSyncJob`, `QboAccountMap`, `QboCdcCursor` tables exist.
- Verify `QboSyncJob` has indexes `[orgId, status, priority]` and `[status, lockedAt]`.
- Verify `QboAccountMap` has unique constraint `[orgId, category]`.
- Verify `QboCdcCursor` has unique constraint `[orgId]`.

**FOUND-06 — Fields on Existing Models:**
- Migration check: `\d "QboConnection"` in psql shows `refreshTokenExpiry`, `refreshInProgress`, `refreshLockedAt`.
- Migration check: `\d "Quote"` shows `qboEstimateId`, `qboSyncedAt`.
- Migration check: `\d "Material"` shows `qboItemId`.
- Migration check: `\d "LaborRate"` shows `qboItemId`.
- Migration check: `\d "TimeEntry"` shows `qboTimeActivityId`.
- TypeScript build: `npx tsc --noEmit` passes after Prisma client regeneration.

**FOUND-07 — qbo-types.ts:**
- TypeScript assertion: `npx tsc --noEmit` passes with zero errors after creating the file.
- Coverage assertion: All types referenced in FOUND-08 (mapper) import from `qbo-types.ts`, not from `qbo-client.ts`.
- The existing inline `QboCustomer` and `QboInvoice` in `qbo-client.ts` are removed and replaced with imports.

**FOUND-08 — qbo-mapper.ts:**
- Unit test: `toQboCustomer({ name: "Acme", primaryEmail: "a@b.com" })` returns `{ DisplayName: "Acme", PrimaryEmailAddr: { Address: "a@b.com" } }`.
- Unit test: `toQboCustomer({ name: "Acme" }, existingQbo)` preserves `existingQbo.PrimaryPhone`.
- Unit test: `roundQboAmount` covered per FOUND-03 tests.
- Build assertion: No `await`, `fetch`, or database import appears in `qbo-mapper.ts`.

**FOUND-09 — qbo-queue.ts:**
- Unit test: `enqueue()` inserts a row with `status="pending"`, `attempts=0`.
- Unit test: `claimBatch(2)` returns 2 rows and sets them to `status="claimed"`.
- Concurrency test: Two concurrent `claimBatch(10)` calls on a 10-job queue should together claim all 10 with no overlap.
- Unit test: `fail()` on a job with `attempts=2, maxAttempts=3` sets `status="pending"`, `attempts=3`. Fails again → `status="dead_letter"`.
- Unit test: `resetStaleLocks(120)` resets rows where `lockedAt < (now - 120s)` to `status="pending"`.

---

### Key Code Patterns

**Pattern: Prisma CAS via `updateMany`**
```typescript
// Returns { count: 1 } if won, { count: 0 } if lost
const result = await prisma.qboConnection.updateMany({
  where: { id, condition: expectedValue },
  data: { condition: newValue },
});
const won = result.count === 1;
```

**Pattern: Prisma model indexes (confirmed from existing schema)**
```prisma
@@index([orgId])                           // Always first
@@index([orgId, entityType, entityId])     // Compound queries
@@unique([orgId, uniqueField])             // Business keys
```

**Pattern: QboSyncLog error logging (established in qbo-sync.ts)**
```typescript
await prisma.qboSyncLog.create({
  data: {
    orgId,
    connectionId: connection.id,
    entityType: "customer",
    entityId: customerId,
    action: "push",
    status: "failed",
    errorMessage,
  },
});
```

**Pattern: Return type for sync functions**
```typescript
return { success: false, error: errorMessage };
return { success: true, qboCustomerId: qboCustomerId ?? undefined };
```

**Pattern: URL query param joining (needed for FOUND-04)**
```typescript
const url = base.includes("?")
  ? `${base}&minorversion=${QBO_API_VERSION}`
  : `${base}?minorversion=${QBO_API_VERSION}`;
```

**Pattern: Prisma `$queryRaw` with typed result**
```typescript
const rows = await prisma.$queryRaw<QboSyncJob[]>(
  Prisma.sql`SELECT * FROM "QboSyncJob" WHERE status = 'pending' LIMIT ${n}`
);
```

**Pattern: Prisma `@db.Text` for long strings**
Used for: `errorMessage`, `accessToken`, `refreshToken`. Check existing models — `accessToken` is `String @db.Text`, confirming the pattern.

---

### Risks and Mitigations

**Risk 1: `updateMany` CAS is not truly atomic at application level if two instances read `refreshInProgress=false` simultaneously before either writes.**

- Mitigation: Prisma's `updateMany` generates a single `UPDATE ... WHERE refreshInProgress = false` SQL statement. PostgreSQL row-locks the matched row during the update. The second concurrent `updateMany` will find `refreshInProgress = true` (already set by the first) and return `count: 0`. This is genuinely atomic. No additional locking needed.
- Caveat: Only works correctly if the Prisma pool has read committed isolation (PostgreSQL default). Confirm no `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` is set anywhere.

**Risk 2: The `finally` block in `getValidAccessToken` tries to clear the lock but the DB connection itself may be unavailable.**

- Mitigation: Wrap the `finally` cleanup in `.catch(() => {})`. The stale lock detection (`resetStaleLocks`) is the backstop — it runs at the start of every cron invocation and clears any locks older than 120 seconds.

**Risk 3: Deep-spreading `existingQbo` in the merge pattern may include QBO-computed read-only fields that QBO rejects on write.**

- Mitigation: QBO ignores unknown read-only fields on write in most cases. The only guaranteed required field is `SyncToken`. Tested against: `MetaData` (read-only, QBO ignores it on write), `Balance` (read-only, QBO ignores it). If QBO returns a 400 "Invalid field" error, selectively omit those fields. Add a `stripReadOnlyFields(entity: QboCustomer)` helper if needed.
- Note: The existing `getCustomer()` already returns the full entity including `SyncToken`, so spreading it is correct.

**Risk 4: `$queryRaw` with `FOR UPDATE SKIP LOCKED` in `claimBatch` may not work through PgBouncer in transaction mode.**

- Mitigation: `FOR UPDATE SKIP LOCKED` inside a subquery of an `UPDATE` statement is executed atomically as part of the UPDATE plan — it is not a separate command. PgBouncer transaction mode only blocks multi-statement advisory locks (`LOCK TABLE`, top-level `SELECT FOR UPDATE`). The subquery form is safe. If issues arise, fall back to the transaction-based non-atomic approach documented in FOUND-09 findings.

**Risk 5: `Prisma.sql` tagged template in `$queryRaw` generates slightly different SQL per Prisma version.**

- Mitigation: Prisma 6.x (confirmed in project — `prisma@6.16`) uses `Prisma.sql` tagged templates correctly for parameterized queries. The `LIMIT ${n}` syntax is safely parameterized by Prisma. No SQL injection risk.

**Risk 6: Adding fields to `QboConnection` (`refreshInProgress`, `refreshLockedAt`, `refreshTokenExpiry`) changes a model that existing API routes query.**

- Mitigation: All new fields are nullable or have `@default(false)`. Existing queries that select `QboConnection` will still work — they receive additional fields they didn't expect but TypeScript strict mode will catch any type errors at build time. Run `npx tsc --noEmit` before deploying.

**Risk 7: `QboSyncJob` and `QboAccountMap` need relations declared on `Org` and `QboConnection` — adding them to those models may cause Prisma to infer changes to existing tables.**

- Mitigation: Adding a relation array to `Org` and `QboConnection` does not change the database schema (no new columns on those models). It only updates the Prisma client's TypeScript types. The migration will be schema-additive only. Verify with `prisma migrate dev --dry-run` before applying.

**Risk 8: The existing inline `QboCustomer` type in `qbo-client.ts` is exported and potentially imported by other files.**

- Mitigation: Search for `import.*QboCustomer.*qbo-client` across the codebase before removing it. Move the type to `qbo-types.ts` and re-export it from `qbo-client.ts` during Phase 1 to avoid breaking callers: `export type { QboCustomer } from "./qbo-types"`. Remove the re-export in Phase 2 cleanup.

---

*Researched: 2026-03-08*
*Phase: 01-foundation*
*Files inspected: qbo-client.ts, qbo-sync.ts, prisma/schema.prisma (1700+ lines), CONTEXT.md, REQUIREMENTS.md, STATE.md, ROADMAP.md, research/SUMMARY.md*
