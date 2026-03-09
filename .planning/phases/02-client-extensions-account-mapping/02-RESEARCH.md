# Phase 2 Research: Client Extensions + Account Mapping

**Researched:** 2026-03-09
**Requirements:** FOUND-10, ACCT-01, ACCT-02, ACCT-03

---

## 1. QBO Batch API

### Endpoint

```
POST https://quickbooks.api.intuit.com/v3/company/<realmId>/batch
```

The path relative to the company base (what `qboRequest()` uses) is just `batch`. In the existing
`qboRequest()` helper, the full URL is constructed as:

```
${getApiBase()}/${connection.realmId}/batch?minorversion=75
```

### Request Format

The body is a JSON object with a single key `BatchItemRequest`, which is an array of operation
objects. Each item in the array must include:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `bId` | string | Yes | Caller-defined correlation ID, returned verbatim in the response |
| `operation` | string | For entity ops | `"create"` / `"update"` / `"delete"` — omit for Query items |
| `[EntityName]` | object | For entity ops | The entity payload — key is the entity type name (e.g., `"Invoice"`, `"Customer"`) |
| `Query` | string | For query ops | The IQL query string — used instead of `operation` + entity |

Full request example with mixed operations:

```json
{
  "BatchItemRequest": [
    {
      "bId": "bid1",
      "operation": "create",
      "Customer": {
        "DisplayName": "Acme Corp"
      }
    },
    {
      "bId": "bid2",
      "operation": "update",
      "Invoice": {
        "Id": "96",
        "SyncToken": "3",
        "sparse": true,
        "PrivateNote": "Updated via batch"
      }
    },
    {
      "bId": "bid3",
      "Query": "SELECT Id, DisplayName FROM Customer WHERE Active = true STARTPOSITION 1 MAXRESULTS 100"
    }
  ]
}
```

### Response Format

The HTTP response is always 200 (even when individual operations fail). The body has a single key
`BatchItemResponse`, which is an array of result objects. Each item includes:

| Field | Present when | Notes |
|-------|-------------|-------|
| `bId` | Always | Matches the request `bId` |
| `[EntityName]` | Operation succeeded | Contains the created/updated entity |
| `QueryResponse` | Query succeeded | Standard query result with entity array |
| `Fault` | Operation failed | Per-operation error — does NOT fail the overall HTTP request |

Response example:

```json
{
  "BatchItemResponse": [
    {
      "bId": "bid1",
      "Customer": {
        "Id": "123",
        "SyncToken": "0",
        "DisplayName": "Acme Corp"
      }
    },
    {
      "bId": "bid2",
      "Fault": {
        "Error": [
          {
            "Message": "Stale Object Error",
            "Detail": "You have an old version of this object...",
            "code": "5010",
            "element": ""
          }
        ],
        "type": "ValidationFault"
      }
    },
    {
      "bId": "bid3",
      "QueryResponse": {
        "Customer": [...],
        "startPosition": 1,
        "maxResults": 50
      }
    }
  ],
  "time": "2024-01-15T10:00:00.000-08:00"
}
```

### Key Limits

| Limit | Value |
|-------|-------|
| Max operations per batch | **30** (Intuit's stated recommendation; treat as a hard limit) |
| Batch requests per minute (production) | 40 per realmId per app |
| HTTP timeout | 120 seconds |
| Max query results per page | 1,000 (default 100) |

### Error Handling Notes

- The HTTP response is always 200 as long as the batch itself was accepted
- Per-operation failures appear as `Fault` in that item's `BatchItemResponse` entry
- A `Fault` item does NOT affect other items — other operations in the same batch still run
- If the overall batch is rejected (bad auth, malformed JSON, over-limit) you get a non-200 HTTP response with a top-level `Fault`
- Implementation must iterate `BatchItemResponse` and check for `Fault` on each item by `bId`

### `batchRequest()` Implementation Approach

```typescript
export async function batchRequest(
  connection: QboConnection,
  operations: QboBatchOperation[]  // array, max 30
): Promise<QboBatchItemResponse[]>
```

Where `QboBatchOperation` is:

```typescript
type QboBatchOperation =
  | { bId: string; operation: "create" | "update" | "delete"; [entity: string]: unknown }
  | { bId: string; Query: string };
```

And `QboBatchItemResponse` is:

```typescript
type QboBatchItemResponse = {
  bId: string;
  Fault?: QboFault;          // Already defined in qbo-types.ts
  QueryResponse?: Record<string, unknown>;
  [entity: string]: unknown; // Entity result for create/update
};
```

The function should throw if `operations.length > 30` before making any HTTP call.

---

## 2. QBO Query API

### Endpoint

```
GET https://quickbooks.api.intuit.com/v3/company/<realmId>/query?query=<URL-encoded-IQL>
```

`qboRequest()` can handle this as a GET with the query string embedded in the path:

```typescript
await qboRequest(connection, "GET", `query?query=${encodeURIComponent(iql)}`);
```

The `minorversion=75` appended by `qboRequest()` stacks correctly with the `&` branch in the existing
URL construction logic (the code already checks for `?` before appending).

### Query Language Syntax (IQL)

```
SELECT * | count(*) FROM <Entity>
  [WHERE <field> <operator> <value> [AND <field> <operator> <value>]]
  [ORDERBY <field> [ASC | DESC]]
  [STARTPOSITION <n>]
  [MAXRESULTS <n>]
```

Rules:
- `FROM` entity name is case-sensitive (e.g., `Account` not `account`)
- Only one entity per query
- `WHERE` supports: `=`, `<`, `>`, `<=`, `>=`, `LIKE` (wildcard: `%`), `IN`
- `AND` only — no `OR` support
- `LIKE` example: `WHERE Name LIKE 'Service%'`
- Boolean values: `true` / `false` (no quotes)
- Null match: `' '` (space in quotes)
- Max 1,000 results per page; default 100

### Account-Specific Queries (for ACCT-01)

Fetch all active accounts:
```sql
SELECT * FROM Account WHERE Active = true MAXRESULTS 1000
```

Fetch only Income accounts:
```sql
SELECT * FROM Account WHERE Active = true AND AccountType = 'Income' MAXRESULTS 1000
```

Fetch Income + Expense + Cost of Goods Sold accounts (for the mapping dropdowns):
```sql
SELECT * FROM Account WHERE Active = true AND (AccountType IN ('Income', 'Expense', 'Cost of Goods Sold')) MAXRESULTS 1000
```

Note: The `IN` operator works on string fields. The actual Chart of Accounts for a typical QBO
company rarely exceeds 300 accounts, so pagination is unlikely needed in practice, but the
`queryEntities()` implementation should handle it.

### Pagination

```sql
SELECT * FROM Account WHERE Active = true STARTPOSITION 1 MAXRESULTS 1000
-- next page:
SELECT * FROM Account WHERE Active = true STARTPOSITION 1001 MAXRESULTS 1000
```

`totalCount` is only returned if the query uses `count(*)`. For paginating `*` queries, keep
fetching until `QueryResponse.maxResults < MAXRESULTS` (last page has fewer results than requested).

### Response Format

```json
{
  "QueryResponse": {
    "Account": [
      {
        "Id": "1",
        "SyncToken": "0",
        "Name": "Services",
        "AccountType": "Income",
        "AccountSubType": "ServiceFeeIncome",
        "Active": true,
        "Classification": "Revenue"
      }
    ],
    "startPosition": 1,
    "maxResults": 50
  },
  "time": "2024-01-15T10:00:00.000-08:00"
}
```

### `queryEntities()` Implementation Approach

```typescript
export async function queryEntities<T>(
  connection: QboConnection,
  iql: string,           // Full IQL string, caller constructs it
  entityName: string     // Key to extract from QueryResponse (e.g., "Account")
): Promise<T[]>
```

Returns the entity array directly. Handles the `QueryResponse.[entityName]` extraction. For
Phase 2 the caller always constructs the IQL — no dynamic builder needed yet.

---

## 3. QBO CDC API

### Endpoint

```
GET https://quickbooks.api.intuit.com/v3/company/<realmId>/cdc
  ?entities=<comma-separated-entity-list>
  &changedSince=<ISO8601-datetime>
```

In `qboRequest()` terms, the path is:

```typescript
`cdc?entities=${entities}&changedSince=${encodeURIComponent(changedSince)}`
```

The `minorversion=75` appended by `qboRequest()` will attach correctly via `&` (since the path
already contains `?`).

### Parameters

| Parameter | Format | Notes |
|-----------|--------|-------|
| `entities` | Comma-separated, no spaces | `Customer,Invoice,Payment,Estimate,Item` |
| `changedSince` | ISO 8601 with timezone | `2024-01-15T10:00:00-08:00` — must be within the past **30 days** |

### Supported Entity Types

The following entity types are supported for CDC (entities the system needs for Phase 4+):
`Customer`, `Invoice`, `Payment`, `Estimate`, `Item`, `Account`, `Vendor`, `Employee`,
`TimeActivity`, `Bill`, `Purchase`

### Response Format

```json
{
  "CDCResponse": [
    {
      "QueryResponse": [
        {
          "Customer": [
            {
              "Id": "63",
              "SyncToken": "2",
              "DisplayName": "Acme Corp",
              "MetaData": {
                "LastUpdatedTime": "2024-01-15T10:05:15-08:00"
              }
            },
            {
              "Id": "99",
              "status": "Deleted",
              "MetaData": {
                "LastUpdatedTime": "2024-01-15T10:06:00-08:00"
              }
            }
          ],
          "startPosition": 1,
          "maxResults": 2
        },
        {
          "Invoice": [
            {
              "Id": "34",
              "MetaData": {
                "LastUpdatedTime": "2024-01-15T09:30:00-08:00"
              }
            }
          ],
          "startPosition": 1,
          "maxResults": 1,
          "totalCount": 5
        }
      ]
    }
  ],
  "time": "2024-01-15T10:00:01-08:00"
}
```

Key observations:
- `CDCResponse` is an array (always one element for a single CDC request)
- Inside, `QueryResponse` is an array of per-entity result objects
- Each entity result object has the entity name as a key containing the array of changed entities
- Deleted entities have `"status": "Deleted"` — they only contain `Id` and `MetaData`
- The `time` at the top level is the timestamp to use as `changedSince` for the next poll

### `cdcRequest()` Implementation Approach

```typescript
export async function cdcRequest(
  connection: QboConnection,
  entities: string[],        // ["Customer", "Invoice", "Payment"]
  changedSince: Date         // Will be ISO-formatted with timezone offset
): Promise<QboCdcResponse>   // Already defined in qbo-types.ts
```

Returns the raw `QboCdcResponse` — the caller (Phase 4 CDC engine) does entity extraction.

---

## 4. QBO Void Invoice

### Method

Not a separate endpoint. Void is triggered via a query parameter on the standard invoice POST:

```
POST https://quickbooks.api.intuit.com/v3/company/<realmId>/invoice?operation=void
```

In `qboRequest()` terms, the path is:

```typescript
"invoice?operation=void"
```

The `minorversion=75` attaches via `&` since the path already has `?`.

### Request Body

Minimum required fields only — NOT a full entity payload:

```json
{
  "Id": "129",
  "SyncToken": "0"
}
```

This is different from a sparse update (`sparse: true`). The `operation=void` query param does the
work. The body just identifies which invoice and provides the optimistic concurrency token.

### What Void Does

- Zeros all amounts and quantities on the invoice
- Prepends `"Voided"` to `Invoice.PrivateNote` (prepended to existing text if present)
- The invoice record remains in QBO (it is not deleted)
- Status is set to `"Voided"`

### Response

```json
{
  "Invoice": {
    "status": "Voided",
    "domain": "QBO",
    "Id": "129"
  },
  "time": "2013-03-15T00:18:15.322-07:00"
}
```

Response is minimal — only `Id`, `status`, and `domain` are returned. Does NOT return the full
invoice object.

### SyncToken Requirement

`voidInvoice()` needs the current `SyncToken`. The caller must either:
1. Have the `SyncToken` available from a prior fetch, or
2. Call `getInvoice()` first to obtain the current `SyncToken`

The implementation should accept `SyncToken` as a parameter (not auto-fetch it), keeping the
function pure in terms of API calls made.

### `voidInvoice()` Implementation Approach

```typescript
export async function voidInvoice(
  connection: QboConnection,
  qboInvoiceId: string,
  syncToken: string
): Promise<{ Id: string; status: string }>
```

Uses `qboRequest(connection, "POST", "invoice?operation=void", { Id: qboInvoiceId, SyncToken: syncToken })`.

---

## 5. QBO Send Invoice Email

### Endpoint

Two variants — both are POST to the invoice `send` sub-resource:

```
# Uses BillEmail.Address already on the invoice
POST /v3/company/<realmId>/invoice/<invoiceId>/send

# Overrides the "To" address
POST /v3/company/<realmId>/invoice/<invoiceId>/send?sendTo=<emailAddr>
```

In `qboRequest()` terms:

```typescript
// Without override:
`invoice/${qboInvoiceId}/send`

// With override:
`invoice/${qboInvoiceId}/send?sendTo=${encodeURIComponent(email)}`
```

### Request Body

**Content-Type must be `application/octet-stream`** — not `application/json`. This is the only
QBO endpoint that requires this. The body is empty/ignored.

This means `qboRequest()` as currently written CANNOT be used directly — it always sets
`Content-Type: application/json`. The `sendInvoiceEmail()` function must make a direct `fetch()`
call with overridden headers, OR `qboRequest()` must accept an optional `contentType` parameter.

The cleanest approach: add an optional `options` parameter to `qboRequest()`:

```typescript
async function qboRequest(
  connection: QboConnection,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  options?: { contentType?: string }
): Promise<unknown>
```

Then `sendInvoiceEmail()` passes `{ contentType: "application/octet-stream" }` and a `null` body.

### Response

Returns the full updated invoice object (same as a GET response), with:
- `EmailStatus` set to `"EmailSent"`
- `DeliveryInfo` populated with sending timestamp and method
- `BillEmail.Address` updated to the `sendTo` value if that parameter was used

### Rate Limit Note

QBO enforces **40 emails per day per realmId** in sandbox. Production limit is also present.
Treat send-email as a one-shot action (not retried on transient failure without user intent).

### `sendInvoiceEmail()` Implementation Approach

```typescript
export async function sendInvoiceEmail(
  connection: QboConnection,
  qboInvoiceId: string,
  sendTo?: string    // Optional email override
): Promise<QboInvoice>
```

---

## 6. Existing Code Patterns

### `qboRequest()` — The Foundation

Location: `src/lib/qbo/qbo-client.ts:219`

```typescript
async function qboRequest(
  connection: QboConnection,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown>
```

Key behaviors:
1. Calls `getValidAccessToken(connection)` — handles refresh lock, polling, stale lock detection
2. Constructs URL as `${getApiBase()}/${connection.realmId}/${path}` then appends `?minorversion=75`
   or `&minorversion=75` depending on whether `?` is already in the path
3. Sets `Authorization: Bearer <token>`, `Accept: application/json`, `Content-Type: application/json`
4. Throws on non-200 responses with `QBO API error (<method> <path>): <status> <body>`
5. Returns `response.json()` — caller must cast to the expected type

**All 5 new methods build on `qboRequest()`**. The exception is `sendInvoiceEmail()` which needs
`Content-Type: application/octet-stream` — this requires a small extension to `qboRequest()`.

### Export Pattern

All functions in `qbo-client.ts` are named exports (not a class). New methods follow the same
pattern:

```typescript
export async function batchRequest(...): Promise<QboBatchItemResponse[]> { ... }
export async function queryEntities<T>(...): Promise<T[]> { ... }
export async function cdcRequest(...): Promise<QboCdcResponse> { ... }
export async function voidInvoice(...): Promise<{ Id: string; status: string }> { ... }
export async function sendInvoiceEmail(...): Promise<QboInvoice> { ... }
```

### Auth Flow (Existing)

The `getValidAccessToken(connection)` function (lines 136-214) implements a DB-level CAS mutex:
- Check expiry with 5-minute buffer
- CAS update `refreshInProgress = true` — wins the lock if `count === 1`
- Winner performs the refresh; others poll every 200ms up to 5 times
- Stale lock (>30s) is force-cleared and the caller retries

New methods inherit this automatically by calling `qboRequest()`.

### Multi-Tenant Pattern (API routes)

Every API route uses:

```typescript
const authResult = await requireAuthSessionFirst(req);
if ("error" in authResult) return authResult.error;
const { orgId, userId, role } = authResult.auth;
```

Then all Prisma queries include `orgId`. New API routes (`/api/integrations/qbo/accounts` and
`/api/integrations/qbo/account-mapping`) must follow this exact pattern.

### `apiFetch()` Pattern (UI)

The integrations page uses `apiFetch()` for all API calls — not raw `fetch()`. This wrapper
handles credentials, base URL, and auth headers. New UI code in the integrations page follows
the same pattern:

```typescript
const res = await apiFetch("/api/integrations/qbo/accounts");
const json = await res.json();
// json.data contains the payload
```

Responses follow the `{ data: <payload> }` envelope.

### Sync Function Pattern (qbo-sync.ts)

Each sync function in `qbo-sync.ts` follows this structure:

```typescript
export async function syncXxxToQbo(orgId, entityId): Promise<{ success: boolean; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) return { success: false, error: "No active QBO connection" };

  // ... fetch entity from Prisma
  // ... do QBO API work
  // ... update Prisma with QBO ID
  // ... write QboSyncLog success record

  try { ... }
  catch (err) {
    // ... write QboSyncLog failure record
    return { success: false, error: errorMessage };
  }
}
```

### QboAccountMap Model (Prisma)

Already created in Phase 1. Located at line 1780 in `prisma/schema.prisma`:

```prisma
model QboAccountMap {
  id             String   @id @default(uuid()) @db.Uuid
  orgId          String   @db.Uuid
  category       String   // "labor_income" | "materials_income" | "service_income" | "job_cost_expense" | "subcontractor_expense"
  qboAccountId   String
  qboAccountName String
  qboAccountType String   // "Income" | "Expense" | "Cost of Goods Sold"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  org Org @relation(fields: [orgId], references: [id])

  @@unique([orgId, category])
  @@index([orgId])
}
```

The `@@unique([orgId, category])` constraint enables upsert-by-category — use `prisma.qboAccountMap.upsert`
with `where: { orgId_category: { orgId, category } }`.

---

## 7. Account Mapping Integration Points

### Where the Gate Goes in `qbo-sync.ts`

The prerequisite gate check belongs in `qbo-sync.ts`, called at the TOP of any sync function that
touches financial transactions. The check runs before any QBO API call:

```typescript
// In syncInvoiceToQbo():
const connection = await getActiveConnection(orgId);
if (!connection) return { success: false, error: "No active QBO connection" };

// Gate check — BEFORE any API calls
const mapping = await requireAccountMapping(orgId);
if (!mapping.complete) {
  return {
    success: false,
    error: "Account mapping required — configure in QBO Settings",
    missingCategories: mapping.missing,
  };
}
```

Functions that need the gate (all financial transaction syncs):
- `syncInvoiceToQbo()` — needs `labor_income`, `materials_income`, `service_income`
- Future: item sync, estimate sync, expense sync (Phase 3+)

Functions that do NOT need the gate:
- `syncCustomerToQbo()` — customer is not a financial transaction
- `handleQboPaymentWebhook()` — inbound only

### New Helper Functions to Add to `qbo-sync.ts`

```typescript
/**
 * Get a specific account mapping for an org and category.
 * Throws a descriptive error if not configured.
 */
export async function getAccountMapping(
  orgId: string,
  category: string
): Promise<{ qboAccountId: string; qboAccountName: string; qboAccountType: string }>

/**
 * Check if all required account mappings are configured for an org.
 * Returns { complete: true } when all 5 categories are mapped.
 * Returns { complete: false, missing: [...] } when any are missing.
 */
export async function requireAccountMapping(
  orgId: string
): Promise<{ complete: boolean; missing: string[] }>
```

### New API Routes Required

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/qbo/accounts` | GET | Fetch active accounts from QBO via `queryEntities()` |
| `/api/integrations/qbo/account-mapping` | GET | Load saved mappings from DB |
| `/api/integrations/qbo/account-mapping` | PUT | Save a mapping (upsert by category) |

### Where the UI Warning Goes

In `page.tsx` (integrations page), when `status.connected === true`:
- Call `GET /api/integrations/qbo/account-mapping` after fetching status
- If fewer than 5 categories are mapped, render a warning banner:
  `"Account mapping incomplete — financial syncs are blocked. Configure mapping below."`
- The mapping section (with dropdowns) is rendered immediately below connection details

---

## 8. UI Patterns

### Existing CSS Classes Available in `integrations.css`

| Class | Purpose |
|-------|---------|
| `.integration-card` | White card with border-radius 12px, border `#e5e7eb` |
| `.integration-card-header` | Flex row with bottom border, padding 24px |
| `.integration-card-body` | Padding 24px |
| `.integration-detail-row` | Flex column, label + value stacked |
| `.detail-label` | 0.75rem, uppercase, `#6b7280` |
| `.detail-value` | 0.875rem, `#111827`, font-weight 500 |
| `.integration-actions` | Flex row, gap 12px, wraps on mobile |
| `.integration-actions .btn-secondary` | Gray outline button |
| `.integration-actions .btn-danger` | Red outline button |
| `.integrations-message--success` | Green banner |
| `.integrations-message--error` | Red banner |
| `.sync-log-section` | Section with top border, for tables |
| `.sync-status--success/failed/pending` | Inline status badges |
| `.integration-status-badge.connected` | Green pill badge |

### New CSS Needed for Account Mapping Section

The account mapping section does not reuse the `integration-card` (it lives inside the existing
card body). It needs:

```css
/* Mapping section header with status indicator */
.account-mapping-section { }          /* border-top separator within card body */
.mapping-status-indicator { }         /* green check / orange warning badge row */

/* Category mapping rows */
.mapping-row { }                       /* label + select + account type tag per row */
.mapping-row label { }                 /* category name left-aligned */
.mapping-select { }                    /* QBO account dropdown, full width on mobile */
.mapping-account-type { }             /* small tag showing "Income" / "Expense" */

/* Accounts loading state */
.mapping-accounts-loading { }         /* spinner row while fetching accounts */
.mapping-accounts-error { }           /* retry button row on fetch failure */
```

Design decisions (following project CSS standards):
- Orange `var(--accent, #f97316)` for the save/refresh action buttons (NOT blue)
- Blue is info-only in this codebase — do not use for buttons
- All transitions use `var(--transition, 200ms)` or `200ms`
- No `:root` variable blocks in `integrations.css` — use inline values or existing vars

### Component State for Account Mapping UI

```typescript
type QboAccount = { Id: string; Name: string; AccountType: string; FullyQualifiedName?: string };
type AccountMapping = { category: string; qboAccountId: string; qboAccountName: string; qboAccountType: string };

// State in the page component:
const [accounts, setAccounts] = useState<QboAccount[]>([]);
const [accountsLoading, setAccountsLoading] = useState(false);
const [mappings, setMappings] = useState<Record<string, AccountMapping>>({});
const [savingCategory, setSavingCategory] = useState<string | null>(null);
```

The mapping categories are a fixed list:
```typescript
const MAPPING_CATEGORIES = [
  { key: "labor_income",         label: "Labor Income",         filterType: "Income" },
  { key: "materials_income",     label: "Materials Income",     filterType: "Income" },
  { key: "service_income",       label: "Service Fee Income",   filterType: "Income" },
  { key: "job_cost_expense",     label: "Job Cost Expense",     filterType: ["Expense", "Cost of Goods Sold"] },
  { key: "subcontractor_expense",label: "Subcontractor Expense",filterType: ["Expense", "Cost of Goods Sold"] },
];
```

Each dropdown shows only accounts matching `filterType` for that category — Income accounts for
income categories, Expense/COGS accounts for expense categories. This filtering happens client-side
from the full accounts array.

### Save UX — Optimistic Per-Row

Each dropdown saves on `onChange` (no global Save button). Pattern:
1. `onChange` fires → call `PUT /api/integrations/qbo/account-mapping` with the updated category
2. Show a per-row saving spinner (`savingCategory === key`)
3. On success: update local `mappings` state and clear spinner
4. On failure: show inline error and revert the dropdown to previous value

This gives immediate feedback without requiring a full form submission flow.

### Mapping Status Indicator Logic

```typescript
const mappedCount = Object.keys(mappings).length;
const allMapped = mappedCount === MAPPING_CATEGORIES.length;  // === 5

// In JSX:
<div className={`mapping-status-indicator ${allMapped ? "complete" : "incomplete"}`}>
  {allMapped
    ? "All accounts mapped — financial syncs enabled"
    : `${mappedCount}/5 accounts mapped — financial syncs blocked`}
</div>
```

---

## 9. Validation Architecture

### What Tests Must Verify

These test cases should be added to `src/__tests__/lib/qbo/qbo-client.test.ts`:

**`batchRequest()` — FOUND-10**
- Throws if `operations.length > 30` before making any HTTP call
- Sends a single POST to `batch?minorversion=75`
- Returns array of `BatchItemResponse` items in same order as input
- A `Fault` on one item does not cause the function to throw — it's returned in the result array
- Overall HTTP non-200 causes function to throw (same as `qboRequest()`)

**`queryEntities()` — FOUND-10**
- Appends `minorversion=75` correctly (path has `?`, so `&` must be used)
- Extracts the entity array from `QueryResponse.[entityName]`
- Returns empty array when `QueryResponse` contains no matching key (no results)
- Passes the exact IQL string to the QBO query endpoint URL-encoded

**`cdcRequest()` — FOUND-10**
- Formats `changedSince` as ISO 8601 string
- Joins entity array with comma and no spaces
- Returns raw `QboCdcResponse` for the caller to process

**`voidInvoice()` — FOUND-10**
- POSTs to `invoice?operation=void` (not `invoice/<id>`)
- Sends `{ Id, SyncToken }` in body — nothing else
- Returns `{ Id, status }` from the response

**`sendInvoiceEmail()` — FOUND-10**
- POSTs to `invoice/<id>/send` with `Content-Type: application/octet-stream`
- Appends `?sendTo=<email>` only when the optional email param is provided
- Returns `QboInvoice` with `EmailStatus === "EmailSent"`

These test cases should be added to a new file
`src/__tests__/lib/qbo/qbo-account-mapping.test.ts`:

**`requireAccountMapping()` — ACCT-03**
- Returns `{ complete: true, missing: [] }` when all 5 categories have DB rows for the org
- Returns `{ complete: false, missing: ["job_cost_expense"] }` when one category is absent
- Returns `{ complete: false, missing: [...all 5...] }` when no rows exist for the org
- Does NOT query another org's mappings (multi-tenant isolation)

**`getAccountMapping()` — ACCT-03**
- Returns the mapping when found
- Throws with message `"Account mapping required..."` when category not found

**Gate in `syncInvoiceToQbo()` — ACCT-03**
- Returns `{ success: false, error: "Account mapping required — configure in QBO Settings" }`
  when `requireAccountMapping` returns `complete: false`
- Does NOT call any QBO API when mapping is incomplete (gate fires before API calls)

### Integration Test Checks (Manual / E2E)

For the success criteria in the roadmap:

1. **Batch test**: Call `batchRequest()` with exactly 30 operations (30 customer creates on sandbox).
   Assert: one HTTP request in network tab, 30 items in `BatchItemResponse`.

2. **Chart of Accounts UI**: Connect to sandbox QBO, navigate to `/settings/integrations`,
   confirm accounts list renders (non-empty) with a Refresh button, confirm Refresh re-fetches.

3. **Mapping persistence**: Select an account for each of the 5 categories, reload the page,
   confirm all 5 selections are still populated from the DB.

4. **Gate enforcement**: With no mappings configured, call `syncInvoiceToQbo()` directly or via
   the sync API. Confirm the response body is
   `{ success: false, error: "Account mapping required — configure in QBO Settings" }`.

---

## RESEARCH COMPLETE

**Key findings that affect planning:**

1. **`sendInvoiceEmail()` needs `Content-Type: application/octet-stream`** — this means `qboRequest()`
   must be extended with an optional `contentType` override, or `sendInvoiceEmail()` makes its own
   direct `fetch()` call. Recommended: extend `qboRequest()` with an options parameter to avoid
   duplicating auth logic.

2. **`voidInvoice()` uses `?operation=void` query param** — NOT a sparse update with `void: true`.
   The body is only `{ Id, SyncToken }`. This is a unique pattern not used by any existing method.

3. **Batch response is always HTTP 200** — per-operation errors appear as `Fault` items in
   `BatchItemResponse`. The implementation must iterate the response array to find failures,
   never relying on HTTP status alone.

4. **CDC `changedSince` must be within 30 days** — relevant for Phase 4; the `QboCdcCursor`
   model (already in DB) stores `lastPollAt` which serves as the `changedSince` value.

5. **Chart of Accounts does NOT need a DB table** — confirmed by user decision in CONTEXT.md.
   Re-fetch on page load + session-cache in React state. The `GET /api/integrations/qbo/accounts`
   route calls `queryEntities()` live every time.

6. **`QboAccountMap` upsert key** — `@@unique([orgId, category])` generates a Prisma compound
   unique key called `orgId_category`, used as `where: { orgId_category: { orgId, category } }` in
   `prisma.qboAccountMap.upsert()`.

7. **Batch limit discrepancy** — Intuit documentation says "recommended maximum of 30" but an
   older blog reference says "up to 10 per batch". The current (2024+) limit documentation
   consistently states 30. Plan for 30 as the hard cap and enforce it with a throw.
