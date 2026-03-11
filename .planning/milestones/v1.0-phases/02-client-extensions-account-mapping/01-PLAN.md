---
phase: 2
plan: 01
title: QBO Client Extension Methods + Batch Types
wave: 1
depends_on: []
requirements: [FOUND-10]
files_modified:
  - src/lib/qbo/qbo-types.ts
  - src/lib/qbo/qbo-client.ts
autonomous: true
estimated_effort: medium
---

# Plan 01: QBO Client Extension Methods + Batch Types

<context>
## Background
Phase 1 delivered the foundational `qbo-client.ts` with `qboRequest()`, `createCustomer()`, `updateCustomer()`, `createInvoice()`, and `getCompanyInfo()`. Phase 2 requires 5 new methods that all future sync modules depend on: `batchRequest()`, `queryEntities()`, `cdcRequest()`, `voidInvoice()`, and `sendInvoiceEmail()`. All build on the existing `qboRequest()` helper. The `sendInvoiceEmail()` method is unique — it requires `Content-Type: application/octet-stream` instead of `application/json`, so `qboRequest()` must be extended with an optional `contentType` override.

The batch and CDC response types need to be added to `qbo-types.ts` — the batch types (`QboBatchOperation`, `QboBatchItemResponse`) are new, while the CDC and query response types already exist.
</context>

<tasks>
## Tasks

### Task 1: Add batch types to qbo-types.ts

At the bottom of `src/lib/qbo/qbo-types.ts`, before the closing "RESPONSE WRAPPER TYPES" section, add these new types:

```typescript
// ============================================
// BATCH API TYPES
// ============================================

/** A single operation in a QBO batch request */
export type QboBatchOperation =
  | {
      bId: string;
      operation: "create" | "update" | "delete";
      [entity: string]: unknown;
    }
  | {
      bId: string;
      Query: string;
    };

/** A single response item from a QBO batch response */
export type QboBatchItemResponse = {
  bId: string;
  Fault?: QboFault;
  QueryResponse?: Record<string, unknown>;
  [entity: string]: unknown;
};
```

These go BEFORE the existing `QboQueryResponse<T>` and `QboCdcResponse` types (which already exist and stay as-is).

### Task 2: Extend qboRequest() with optional contentType parameter

In `src/lib/qbo/qbo-client.ts`, modify the `qboRequest()` function signature and implementation to accept an optional options parameter:

**Change the function signature from:**
```typescript
async function qboRequest(
  connection: QboConnection,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown>
```

**To:**
```typescript
async function qboRequest(
  connection: QboConnection,
  method: string,
  path: string,
  body?: Record<string, unknown> | null,
  options?: { contentType?: string }
): Promise<unknown>
```

Then change the `Content-Type` header line from:
```typescript
"Content-Type": "application/json",
```
To:
```typescript
"Content-Type": options?.contentType || "application/json",
```

### Task 3: Add batchRequest() function

Add to `src/lib/qbo/qbo-client.ts` after the existing `getCompanyInfo()` function and before `verifyWebhookSignature()`. Import the new types at the top of the file.

**Add to the import at the top:**
```typescript
import type { QboCustomer, QboInvoice, QboBatchOperation, QboBatchItemResponse, QboCdcResponse, QboAccount } from "./qbo-types";
```
(Update the existing import line to include the new types.)

Also update the re-export line to add the new types:
```typescript
export type { QboCustomer, QboInvoice, QboBatchOperation, QboBatchItemResponse, QboCdcResponse, QboAccount };
```

**Function implementation:**
```typescript
/**
 * Send a batch request to QBO (up to 30 operations per batch).
 * Each operation can be a CRUD operation or a query.
 * Returns an array of results — check each item for Fault.
 * The overall HTTP response is always 200 when the batch is accepted;
 * per-operation failures appear as Fault in individual items.
 */
export async function batchRequest(
  connection: QboConnection,
  operations: QboBatchOperation[]
): Promise<QboBatchItemResponse[]> {
  if (operations.length === 0) {
    return [];
  }
  if (operations.length > 30) {
    throw new Error(
      `QBO batch limit is 30 operations, received ${operations.length}`
    );
  }

  const result = (await qboRequest(connection, "POST", "batch", {
    BatchItemRequest: operations,
  })) as { BatchItemResponse: QboBatchItemResponse[] };

  return result.BatchItemResponse || [];
}
```

### Task 4: Add queryEntities() function

Add immediately after `batchRequest()`:

```typescript
/**
 * Execute an IQL query against the QBO API and return the entity array.
 * Caller provides the full IQL string and the entity name to extract.
 * Returns an empty array if no results found.
 *
 * Example: queryEntities<QboAccount>(connection, "SELECT * FROM Account WHERE Active = true", "Account")
 */
export async function queryEntities<T>(
  connection: QboConnection,
  iql: string,
  entityName: string
): Promise<T[]> {
  const result = (await qboRequest(
    connection,
    "GET",
    `query?query=${encodeURIComponent(iql)}`
  )) as { QueryResponse: Record<string, unknown> };

  const entities = result.QueryResponse?.[entityName];
  if (Array.isArray(entities)) {
    return entities as T[];
  }
  return [];
}
```

### Task 5: Add cdcRequest() function

Add immediately after `queryEntities()`:

```typescript
/**
 * Call the QBO Change Data Capture (CDC) endpoint.
 * Returns all entities changed since the given timestamp.
 * changedSince must be within the past 30 days.
 */
export async function cdcRequest(
  connection: QboConnection,
  entities: string[],
  changedSince: Date
): Promise<QboCdcResponse> {
  const entityList = entities.join(",");
  const sinceStr = changedSince.toISOString();

  const result = (await qboRequest(
    connection,
    "GET",
    `cdc?entities=${entityList}&changedSince=${encodeURIComponent(sinceStr)}`
  )) as QboCdcResponse;

  return result;
}
```

### Task 6: Add voidInvoice() function

Add immediately after `cdcRequest()`:

```typescript
/**
 * Void an invoice in QBO. The invoice is zeroed out but not deleted.
 * Requires the current SyncToken for optimistic concurrency.
 * Uses the ?operation=void query parameter — NOT a sparse update.
 */
export async function voidInvoice(
  connection: QboConnection,
  qboInvoiceId: string,
  syncToken: string
): Promise<{ Id: string; status: string }> {
  const result = (await qboRequest(
    connection,
    "POST",
    "invoice?operation=void",
    { Id: qboInvoiceId, SyncToken: syncToken }
  )) as { Invoice: { Id: string; status: string } };

  return result.Invoice;
}
```

### Task 7: Add sendInvoiceEmail() function

Add immediately after `voidInvoice()`:

```typescript
/**
 * Send an invoice via QBO's email service.
 * Uses the BillEmail.Address on the invoice unless sendTo is specified.
 * Requires Content-Type: application/octet-stream (QBO quirk).
 * Note: QBO enforces a daily email limit per realmId.
 */
export async function sendInvoiceEmail(
  connection: QboConnection,
  qboInvoiceId: string,
  sendTo?: string
): Promise<QboInvoice> {
  const path = sendTo
    ? `invoice/${qboInvoiceId}/send?sendTo=${encodeURIComponent(sendTo)}`
    : `invoice/${qboInvoiceId}/send`;

  const result = (await qboRequest(connection, "POST", path, null, {
    contentType: "application/octet-stream",
  })) as { Invoice: QboInvoice };

  return result.Invoice;
}
```

</tasks>

<verification>
## Verification
- [ ] `npx tsc --noEmit` completes with zero TypeScript errors
- [ ] `qbo-types.ts` exports `QboBatchOperation` and `QboBatchItemResponse` types
- [ ] `qbo-client.ts` exports 5 new functions: `batchRequest`, `queryEntities`, `cdcRequest`, `voidInvoice`, `sendInvoiceEmail`
- [ ] `qboRequest()` accepts optional `options.contentType` parameter and defaults to `application/json` when not provided
- [ ] `batchRequest()` throws when `operations.length > 30`
- [ ] `batchRequest()` returns empty array when `operations.length === 0`
- [ ] `queryEntities()` URL-encodes the IQL string in the query parameter
- [ ] `cdcRequest()` joins entities with comma (no spaces) and URL-encodes changedSince
- [ ] `voidInvoice()` POSTs to `invoice?operation=void` (not `invoice/<id>`)
- [ ] `sendInvoiceEmail()` passes `contentType: "application/octet-stream"` through options
- [ ] Build succeeds: `npm run build` completes without errors
</verification>

<must_haves>
## Must-Haves (Goal-Backward)
- All 5 new client methods (`batchRequest`, `queryEntities`, `cdcRequest`, `voidInvoice`, `sendInvoiceEmail`) are exported from `qbo-client.ts` and callable by downstream sync modules
- `batchRequest()` sends a single POST to QBO's `/batch` endpoint, not individual API calls
- `voidInvoice()` uses the `?operation=void` query parameter pattern (not sparse update with `void: true`)
- `sendInvoiceEmail()` sets `Content-Type: application/octet-stream` (the only QBO endpoint requiring this)
- Existing functions in `qbo-client.ts` are not broken by the `qboRequest()` signature change
</must_haves>
