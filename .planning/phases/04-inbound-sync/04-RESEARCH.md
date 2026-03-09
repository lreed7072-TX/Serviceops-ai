# Phase 4: Inbound Sync — Research

**Written:** 2026-03-09
**Requirements covered:** PAY-02, SYNC-01, SYNC-02

---

## Existing Code Analysis

### What is already built and usable without modification

**`src/lib/qbo/qbo-client.ts`**

- `cdcRequest(connection, entities, changedSince)` — complete and ready. Calls `GET /cdc?entities=...&changedSince=...`. Returns `QboCdcResponse`. This is the core primitive for SYNC-01.
- `voidInvoice(connection, qboInvoiceId, syncToken)` — complete and ready. Uses `POST invoice?operation=void` with `{ Id, SyncToken }`. This is the mechanism for PAY-02's outbound void path.
- `getInvoice(connection, qboInvoiceId)` — complete and ready. Returns full `QboInvoice` including `Balance`, `SyncToken`, and `status` fields. Needed to check void status during CDC processing.
- `getCustomer(connection, qboCustomerId)` — complete and ready. Not directly called by CDC (CDC gives us the full entity inline), but available for fallback fetching.
- `queryEntities<T>()` — complete, used in `resolveOrCreateQboEntity`. Reusable for customer lookup during conflict resolution.

**`src/lib/qbo/qbo-sync.ts`**

- `getActiveConnection(orgId)` — ready, used in every sync function.
- `syncCustomerToQbo(orgId, customerId)` — outbound push exists. Phase 4 needs the *inbound* path (QBO → ServiceOps), which is a separate new function, not a modification of this one.
- `processPaymentJob(orgId, qboPaymentId, realmId)` — complete (Phase 3). Already handles `Balance === 0` → mark PAID and `Balance > 0` → partial payment log. PAY-02 needs this function to also handle the **void detection** path (QBO invoice status = "Voided" detected via CDC), which is not in this function. A new `processCdcInvoiceChange` function is needed.

**`src/lib/qbo/qbo-mapper.ts`**

- `fromQboCustomer(qbo: QboCustomer)` — already written and ready. Returns the exact fields needed for inbound customer sync: `name`, `primaryEmail`, `primaryPhone`, `billingStreet1`, `billingCity`, `billingState`, `billingPostalCode`. This was built anticipating Phase 4.
- `toQboCustomer(customer, existingQbo?)` — outbound mapper, not needed for inbound but confirms the field ownership split is already codified.

**`src/lib/qbo/qbo-types.ts`**

- `QboCdcResponse` — typed at line 553: `{ CDCResponse: Array<{ QueryResponse: Array<Record<string, unknown>> }> }`. This type is *partially* correct for most use cases but needs review — see Risk 3 below.
- `QboCustomer` — complete (line 101). All inbound customer fields are typed: `DisplayName`, `PrimaryEmailAddr`, `PrimaryPhone`, `BillAddr`, `SalesTermRef`, `PaymentMethodRef`, `Active`.
- `QboInvoice` — complete (line 139). Has `Balance`, `status` (note: QBO returns `status` as a top-level string when voided, separate from `TxnStatus`), and `SyncToken` for void calls.

**`src/lib/qbo/qbo-queue.ts`**

- `enqueue`, `claimBatch`, `complete`, `fail`, `resetStaleLocks` — all complete. The CDC cron will not use the queue for its own CDC polls (CDC runs synchronously in the cron invocation), but it will enqueue individual entity processing jobs if CDC returns a large number of changes that need deep processing.
- Priority constants are defined: 1=user-triggered, 5=default, 9=bulk. CDC-driven inbound jobs should use priority 5 (already the default).

**`prisma/schema.prisma` — QboCdcCursor model**

```prisma
model QboCdcCursor {
  id             String   @id @default(uuid()) @db.Uuid
  orgId          String   @db.Uuid
  connectionId   String   @db.Uuid
  lastPollAt     DateTime
  lastPollStatus String   @default("success") // "success" | "failed"
  lastPollError  String?  @db.Text
  entityTypes    String   // Comma-separated: "Customer,Invoice,Payment,Estimate,Item"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([orgId])  // One cursor per org
}
```

This is fully built. `@@unique([orgId])` means upsert-on-`orgId` is the correct update pattern (not update-on-`id`). The `lastPollAt` field is the changedSince timestamp for the next CDC call. The `entityTypes` comma-separated field means the cursor covers all entity types in a single poll (correct — one CDC call per org per invocation, not one per entity type).

**`src/app/api/integrations/qbo/webhook/route.ts`**

The thin dispatcher is complete from Phase 3. It already handles `Customer` entity events (maps to `customer` type, enqueues as `push` for Create, `pull` for Update/Delete). The Phase 4 webhook addition is:
- `Invoice` update/delete events currently get enqueued as `invoice:pull` jobs. The `qbo-flush` cron dispatcher has NO handler for `invoice:pull` — only `invoice:push`. This is the gap PAY-02 needs to fill.
- `Customer` update events get enqueued as `customer:pull` jobs. The cron dispatcher also has NO handler for `customer:pull`. SYNC-02 needs this.

**`src/app/api/cron/qbo-flush/route.ts`**

The existing `dispatchJob` switch handles: `customer:push`, `invoice:push`, `invoice:email`, `item:push`, `estimate:push`, `payment:pull`. The `default` case throws an unhandled error. Phase 4 must add:
- `invoice:pull` case → `processCdcInvoiceChange(orgId, qboInvoiceId, realmId)`
- `customer:pull` case → `processInboundCustomer(orgId, qboCustomerId, realmId)`
- `invoice:void` case → `processVoidInvoice(orgId, invoiceId)` (ServiceOps cancellation triggers QBO void)

**`vercel.json`**

Currently has two crons: `generate-pms` at `0 6 * * *` and `qbo-flush` at `*/5 * * * *`. Phase 4 adds a third:

```json
{ "path": "/api/cron/qbo-cdc", "schedule": "0 */4 * * *" }
```

This runs every 4 hours at the top of the hour (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC).

---

### What must be built new for Phase 4

**New cron route:** `src/app/api/cron/qbo-cdc/route.ts`

This is the CDC polling engine (SYNC-01). Runs every 4 hours for all connected orgs. Flow:

1. Verify `CRON_SECRET` — same pattern as `qbo-flush`.
2. Fetch all active QboConnections with their QboCdcCursor.
3. For each org's connection:
   a. Get or create the QboCdcCursor (first-run: `lastPollAt = now - 4 hours`).
   b. Call `cdcRequest(connection, ["Customer", "Invoice"], cursor.lastPollAt)`.
   c. Parse the CDCResponse — extract Customer changes and Invoice changes.
   d. For each changed entity, enqueue a job to `qbo-flush` for deferred processing.
   e. Update `QboCdcCursor.lastPollAt = now` on success.
4. Return summary stats: `{ orgsPolled, customersQueued, invoicesQueued, errors }`.

**New sync functions in `src/lib/qbo/qbo-sync.ts`**

Three new functions needed:

1. `processInboundCustomer(orgId, qboCustomerId, realmId, qboCustomerData?)` — SYNC-02 customer inbound sync with conflict resolution.
2. `processCdcInvoiceChange(orgId, qboInvoiceId, realmId)` — PAY-02 invoice inbound: detects void, partial payment balance changes.
3. `processVoidInvoiceInQbo(orgId, invoiceId)` — PAY-02 outbound void: when ServiceOps invoice is CANCELLED, calls `voidInvoice()` with current SyncToken.

**New cron flush cases in `src/app/api/cron/qbo-flush/route.ts`**

The `dispatchJob` switch needs 3 new cases: `invoice:pull`, `customer:pull`, `invoice:void`.

**No new schema migrations needed** — all required models and fields are already in place from Phases 1–3.

---

## Requirement-by-Requirement Analysis

### PAY-02: Invoice status bidirectional sync

**Inbound direction (QBO → ServiceOps):**

The CDC poll will return `Invoice` entities that changed. Two scenarios:

1. **QBO void detected:** QBO returns the invoice with a special marker. When QBO voids an invoice via its UI, the API returns the invoice object with `status: "Voided"` at the top level. Note: `QboInvoice.status` is NOT currently in the `QboInvoice` type definition in `qbo-types.ts` — this field needs to be added. The void state can also be inferred from `Balance === 0` AND `TotalAmt !== 0` AND `Line` entries all have `Amount = 0`, but the cleaner check is `status === "Voided"`.

2. **Partial payment balance change:** QBO returns an invoice with `Balance > 0` (reduced from original but not zero). ServiceOps currently has no "partial payment" status — `Invoice.status` is an enum. The correct behavior per requirement is: reflect the balance change but do not change the invoice status (consistent with Phase 3 `processPaymentJob` which also logs partial payments without status change). Log the balance in QboSyncLog metadata.

3. **Full payment via CDC (Balance = 0, not voided):** CDC may also deliver a fully-paid invoice before the Payment webhook fires. `processCdcInvoiceChange` should mark the invoice PAID in this case — same logic as `processPaymentJob`.

The ServiceOps `Invoice` model has no `balance` or `remainingAmount` field. There is nowhere to store the running balance from QBO. Decision: log balance changes to `QboSyncLog.metadata` only, do not add a new schema field (scoped per SYNC-02 requirement which is in this phase — adding a field would require a migration and is out of scope).

**Outbound direction (ServiceOps → QBO):**

When a ServiceOps invoice status transitions to `CANCELLED`, the system must void the QBO invoice. The trigger point is the PATCH/PUT endpoint that updates invoice status — currently at `src/app/api/invoices/[id]/route.ts`. The void must happen synchronously or be enqueued immediately.

Two approaches:
- **Synchronous void in the API route:** Call `voidInvoice()` directly when `status` changes to `CANCELLED` and invoice has `qboInvoiceId`. Simpler but blocks the response on a QBO API call.
- **Enqueue `invoice:void` job:** Return 200 immediately, process the void in the next cron flush cycle (up to 5 minutes). Consistent with the existing queue architecture.

Recommended approach: **enqueue** — consistent with established architecture. The invoice is already cancelled in ServiceOps; the QBO void is an eventual-consistency downstream effect. The 5-minute delay is acceptable.

The `voidInvoice()` client function requires the invoice's current QBO `SyncToken`. This means `processVoidInvoiceInQbo` must call `getInvoice(connection, qboInvoiceId)` first to get the fresh `SyncToken`, then call `voidInvoice()`. The SyncToken is not stored in the ServiceOps `Invoice` model — it lives only in QBO.

### SYNC-01: CDC polling engine

**Entity list for CDC:** The requirement says "all changed entities." The `QboCdcCursor.entityTypes` field stores a comma-separated list. For Phase 4, the relevant entities are `Customer` and `Invoice`. QBO's CDC endpoint supports: `Customer`, `Invoice`, `Payment`, `Item`, `Estimate`, `Vendor`, `Employee`, `Bill`, `Purchase`, `Account`. Adding `Payment` to the CDC entities is tempting but unnecessary — payments already flow via webhook. To avoid double-processing, Phase 4 CDC should only poll `Customer,Invoice`.

**changedSince window:** QBO CDC requires `changedSince` to be within the past 30 days. The first run for a new connection needs a sensible default. Safe default: `now - 4 hours` (one poll interval back). This avoids pulling a large historical backlog on first run. If `QboCdcCursor` does not yet exist for the org, create it with `lastPollAt = now - 4 hours` before calling CDC.

**Multi-org handling:** The cron must iterate all orgs with active QBO connections. Order of operations:
1. `prisma.qboConnection.findMany({ where: { isActive: true }, include: { cdcCursors: true } })`
2. For each connection, run CDC independently — one org's failure must not block other orgs.
3. Wrap each org's CDC call in `try/catch`. On failure, update `QboCdcCursor.lastPollStatus = "failed"` and `lastPollError = errorMessage` but do NOT advance `lastPollAt` (so the next run retries from the same window).

**Vercel Cron timeout:** Vercel Cron invocations have a 10-minute timeout on Hobby/Pro plans. Processing many orgs sequentially could approach this limit. For Phase 4 with a small number of orgs, sequential processing is fine. Design the loop so each org's CDC + enqueue is isolated and does not create cascading failures.

**CDC response shape vs. current type:** The `QboCdcResponse` type currently has:
```typescript
export type QboCdcResponse = {
  CDCResponse: Array<{
    QueryResponse: Array<{
      startPosition?: number;
      maxResults?: number;
    } & Record<string, unknown>>;
  }>;
};
```
The actual QBO CDC API returns a different structure. Each `CDCResponse` array item has a `QueryResponse` which is an array containing one element per entity type, each element being `{ EntityName: QboEntity[], startPosition, maxResults }`. For example:
```json
{
  "CDCResponse": [{
    "QueryResponse": [
      { "Customer": [...], "startPosition": 1, "maxResults": 5 },
      { "Invoice": [...], "startPosition": 1, "maxResults": 2 }
    ]
  }]
}
```
The current type uses `Record<string, unknown>` which handles this shape, but the parsing code needs to explicitly iterate `QueryResponse` items and check for entity type keys (`Customer`, `Invoice`). The type is technically correct but will require casting when extracting the arrays. No type change strictly needed; a comment clarifying the parsing strategy is enough.

### SYNC-02: Customer inbound sync with conflict resolution

**Field ownership split (established in requirements):**

- **ServiceOps wins:** operational fields — these are not overwritten by QBO data:
  - `status` (Active/Inactive is a ServiceOps operational state)
  - `notes`
  - `tier`, `leadSourceId`, `assignedToUserId` (CRM fields)
  - Site addresses (Site model, not Customer model — QBO has no concept of sites)

- **QBO wins:** billing fields — these ARE overwritten by QBO CDC data:
  - `name` (DisplayName) — though ServiceOps created it, QBO is the billing system of record
  - `primaryEmail`
  - `primaryPhone`
  - `billingStreet1`, `billingCity`, `billingState`, `billingPostalCode`
  - Payment terms (no `paymentTerms` field on ServiceOps Customer model — this would be QBO-only data)

The `fromQboCustomer()` mapper in `qbo-mapper.ts` already implements this split by only returning the fields that QBO should win. The inbound sync function calls `fromQboCustomer()` and updates only those returned fields.

**Lookup flow for inbound customer:**

CDC gives us a `QboCustomer` entity with `Id` (QBO's ID). To find the matching ServiceOps customer:
1. `prisma.customer.findFirst({ where: { qboCustomerId: qbo.Id, orgId } })` — direct match by stored QBO ID (most customers will match this way after Phase 3 outbound sync).
2. If not found: attempt email match — `prisma.customer.findFirst({ where: { primaryEmail: qbo.PrimaryEmailAddr?.Address, orgId } })` — catches customers created in QBO before ServiceOps sync.
3. If not found: **create a new ServiceOps customer** from `fromQboCustomer(qboEntity)` with `qboCustomerId = qbo.Id`. Log this as a "created inbound" event in QboSyncLog.

**Conflict detection:** A conflict occurs when the same field was changed in both systems between polls. ServiceOps has no "last modified by QBO" timestamp per field, so true field-level conflict detection is not feasible. The rule is simple: QBO always wins on billing fields regardless of when each system made the change. Log the update action in QboSyncLog with `metadata: { fieldsUpdated: [...], source: "qbo_cdc" }`. This satisfies the requirement's "conflict decision logged in QboSyncLog" clause.

**Inactive customers:** QBO sets `Active: false` when a customer is deactivated. ServiceOps has a `status` field (string). ServiceOps wins on status — do NOT propagate QBO `Active: false` to ServiceOps `status`. However, log it in QboSyncLog so the admin can see the discrepancy.

---

## Schema Changes Needed

**No Prisma migrations required for Phase 4.**

All necessary models exist:
- `QboCdcCursor` — ready (Phase 1, FOUND-05)
- `QboSyncJob` — ready with `qboEntityId`, `qboRealmId` dedup fields (Phase 3)
- `QboSyncLog` — ready with `metadata Json?` for logging balance changes and conflict decisions
- `Invoice.qboInvoiceId` — ready (Phase 1, FOUND-06)
- `Invoice.status` — `InvoiceStatus` enum; confirm `CANCELLED` is a valid value (check enum definition)
- `Customer.qboCustomerId` — ready (Phase 1, FOUND-06)

One type definition update needed (not a migration):
- Add `status?: string` to `QboInvoice` in `qbo-types.ts` — QBO returns `status: "Voided"` on voided invoices. Currently this field is absent from the type, which means TypeScript will infer `undefined` but the raw API response contains it. Without the type addition, the check `qboInvoice.status === "Voided"` will cause a TypeScript error.

**Confirm `InvoiceStatus` enum has `CANCELLED`:**

Need to verify in `prisma/schema.prisma`. Check the `InvoiceStatus` enum definition — if `CANCELLED` is not present, the void detection code cannot mark ServiceOps invoices accordingly. From Phase 3 context, invoice statuses include DRAFT, SENT, PAID, OVERDUE. Check if CANCELLED/VOID is present.

---

## Implementation Patterns

### Pattern 1: CDC cron structure

The `qbo-cdc` cron follows the same security pattern as `qbo-flush`:

```typescript
// GET /api/cron/qbo-cdc
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = { orgsPolled: 0, customersQueued: 0, invoicesQueued: 0, errors: 0 };

  const connections = await prisma.qboConnection.findMany({
    where: { isActive: true },
    include: { cdcCursors: { take: 1 } },
  });

  for (const connection of connections) {
    try {
      await pollOrgCdc(connection, stats);
    } catch (err) {
      stats.errors++;
      // Update cursor with failure status but do not advance lastPollAt
    }
    stats.orgsPolled++;
  }

  return NextResponse.json({ data: stats });
}
```

### Pattern 2: CDC parsing

The CDCResponse structure requires iterating the `QueryResponse` array and checking for entity type keys:

```typescript
function parseCdcEntities(
  cdcResponse: QboCdcResponse,
  entityName: string
): unknown[] {
  const result: unknown[] = [];
  for (const cdcItem of cdcResponse.CDCResponse) {
    for (const qr of cdcItem.QueryResponse) {
      const entities = (qr as Record<string, unknown>)[entityName];
      if (Array.isArray(entities)) {
        result.push(...entities);
      }
    }
  }
  return result;
}
```

This pattern extracts all Customer or Invoice entities from the CDC response regardless of how QBO distributes them across QueryResponse items.

### Pattern 3: QboCdcCursor upsert

On each successful poll, upsert the cursor with `lastPollAt = new Date()`:

```typescript
await prisma.qboCdcCursor.upsert({
  where: { orgId: connection.orgId },
  create: {
    orgId: connection.orgId,
    connectionId: connection.id,
    lastPollAt: new Date(),
    lastPollStatus: "success",
    entityTypes: "Customer,Invoice",
  },
  update: {
    lastPollAt: new Date(),
    lastPollStatus: "success",
    lastPollError: null,
  },
});
```

On failure, update only the status fields (do NOT update `lastPollAt`):

```typescript
await prisma.qboCdcCursor.upsert({
  where: { orgId: connection.orgId },
  // create: same as above but with "failed" status
  update: {
    lastPollStatus: "failed",
    lastPollError: errorMessage,
    // lastPollAt NOT updated — retry from same window on next run
  },
});
```

### Pattern 4: Inbound customer upsert

```typescript
export async function processInboundCustomer(
  orgId: string,
  qboCustomer: QboCustomer,
  connectionId: string
): Promise<{ success: boolean; action: "created" | "updated" | "skipped"; error?: string }> {
  try {
    // 1. Lookup by QBO ID
    let serviceOpsCustomer = await prisma.customer.findFirst({
      where: { qboCustomerId: qboCustomer.Id, orgId },
    });

    // 2. Fallback: lookup by email
    if (!serviceOpsCustomer && qboCustomer.PrimaryEmailAddr?.Address) {
      serviceOpsCustomer = await prisma.customer.findFirst({
        where: { primaryEmail: qboCustomer.PrimaryEmailAddr.Address, orgId },
      });
    }

    const fields = fromQboCustomer(qboCustomer); // QBO-wins fields only

    if (serviceOpsCustomer) {
      // Update: QBO wins on billing fields
      await prisma.customer.update({
        where: { id: serviceOpsCustomer.id },
        data: { ...fields, qboCustomerId: qboCustomer.Id },
      });
      await prisma.qboSyncLog.create({
        data: { orgId, connectionId, entityType: "customer", entityId: serviceOpsCustomer.id,
          qboEntityId: qboCustomer.Id, action: "pull", status: "success",
          metadata: { source: "qbo_cdc", fieldsUpdated: Object.keys(fields) } },
      });
      return { success: true, action: "updated" };
    } else {
      // Create new customer from QBO data
      const newCustomer = await prisma.customer.create({
        data: { orgId, qboCustomerId: qboCustomer.Id, ...fields,
          createdByUserId: /* system user or org owner */ ... },
      });
      await prisma.qboSyncLog.create({
        data: { orgId, connectionId, entityType: "customer", entityId: newCustomer.id,
          qboEntityId: qboCustomer.Id, action: "pull", status: "success",
          metadata: { source: "qbo_cdc", action: "created_inbound" } },
      });
      return { success: true, action: "created" };
    }
  } catch (err) {
    // log failure
    return { success: false, action: "skipped", error: ... };
  }
}
```

Note: creating a new customer from QBO inbound data requires a `createdByUserId` field (non-nullable on the Customer model per schema line 439: `createdByUserId String? @db.Uuid`). Check schema — Customer does NOT have `createdByUserId`. Only Invoice has it. Customer has `assignedToUserId` and `createdByUserId` as optional CRM fields. Confirm actual Customer schema — from schema read above, Customer does NOT have a required `createdByUserId`. The create will work without it.

### Pattern 5: Invoice void outbound (ServiceOps cancels → QBO voids)

```typescript
export async function processVoidInvoiceInQbo(
  orgId: string,
  invoiceId: string
): Promise<{ success: boolean; error?: string }> {
  const connection = await getActiveConnection(orgId);
  if (!connection) return { success: false, error: "No active QBO connection" };

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, orgId } });
  if (!invoice?.qboInvoiceId) return { success: false, error: "Invoice not synced to QBO" };

  try {
    // Must fetch current SyncToken — not stored in ServiceOps
    const qboInvoice = await getInvoice(connection, invoice.qboInvoiceId);
    await voidInvoice(connection, invoice.qboInvoiceId, qboInvoice.SyncToken);

    await prisma.qboSyncLog.create({
      data: { orgId, connectionId: connection.id, entityType: "invoice",
        entityId: invoiceId, qboEntityId: invoice.qboInvoiceId,
        action: "void", status: "success" },
    });
    return { success: true };
  } catch (err) {
    // log failure
    return { success: false, error: errorMessage };
  }
}
```

The void trigger must be wired into the invoice PATCH route. When `status` transitions to `CANCELLED` and `invoice.qboInvoiceId` is set, call `enqueue(orgId, connectionId, "invoice", invoiceId, "void", 1)` — priority 1 (user-triggered real-time action).

### Pattern 6: Cron dispatcher additions

Add to `dispatchJob` in `qbo-flush/route.ts`:

```typescript
case "invoice:pull": {
  // Invoice updated in QBO — check for void or payment
  const qboInvoiceId = (payload.qboEntityId as string) || job.qboEntityId;
  const realmId = (payload.realmId as string) || job.qboRealmId;
  if (!qboInvoiceId || !realmId) throw new Error("invoice:pull missing qboEntityId or realmId");
  const result = await processCdcInvoiceChange(job.orgId, qboInvoiceId, realmId);
  if (!result.success) throw new Error(result.error || "Invoice CDC processing failed");
  break;
}

case "customer:pull": {
  // Customer updated in QBO — inbound sync with conflict resolution
  const qboCustomerId = (payload.qboEntityId as string) || job.qboEntityId;
  const realmId = (payload.realmId as string) || job.qboRealmId;
  if (!qboCustomerId || !realmId) throw new Error("customer:pull missing qboEntityId or realmId");
  const result = await processCdcCustomerPull(job.orgId, qboCustomerId, realmId);
  if (!result.success) throw new Error(result.error || "Customer inbound sync failed");
  break;
}

case "invoice:void": {
  // ServiceOps invoice cancelled — void it in QBO
  const result = await processVoidInvoiceInQbo(job.orgId, job.entityId);
  if (!result.success) throw new Error(result.error || "Invoice void failed");
  break;
}
```

---

## Risk Areas

### Risk 1: QboInvoice type missing the `status` field for void detection

The `QboInvoice` type in `qbo-types.ts` does not include `status?: string`. When QBO voids an invoice, it returns `status: "Voided"` in the JSON response. TypeScript will allow accessing this via `(qboInvoice as Record<string, unknown>).status`, but the cleaner fix is to add `status?: string` to `QboInvoice`.

Without this fix, the void detection in `processCdcInvoiceChange` will require a type assertion, which is fragile and will confuse future maintainers.

**Recommended fix:** Add `status?: string` to `QboInvoice` in `qbo-types.ts` as part of Phase 4 Plan 01. One-line change, no breaking effect on existing code.

### Risk 2: Invoice CANCELLED status may not exist in the enum

The `InvoiceStatus` enum needs a `CANCELLED` value for the outbound void trigger. From the schema read, the invoice status field is typed as `InvoiceStatus @default(DRAFT)`. The full enum definition was not captured in the schema read — it is defined near line 1330 but the enum block is above that. If `CANCELLED` is not in the enum, either: (a) add it to the enum and generate a migration, or (b) use a different existing status like `VOID`.

**Required action in planning:** Read the `InvoiceStatus` enum definition explicitly and confirm available values. If `CANCELLED` is absent, add it to the schema — this would be the one migration in Phase 4.

### Risk 3: CDC returns entities that were changed by ServiceOps itself

The QBO CDC endpoint returns ALL changes to an entity since `lastPollAt`, including changes that ServiceOps originally pushed outbound. If ServiceOps synced an invoice to QBO at 9:00 AM and the CDC poll runs at 12:00 PM, the CDC response may include that invoice in the changed set (QBO's `MetaData.LastUpdatedTime` was set when ServiceOps created it).

For Customer CDC: this creates a no-op (ServiceOps updates the customer with the same values it just sent). Acceptable, though wasteful.

For Invoice CDC: this could trigger a void detection false positive if there is a logic bug. The `processCdcInvoiceChange` function must check `qboInvoice.status !== "Voided"` before assuming a normal update.

**Recommended mitigation:** In `processCdcInvoiceChange`, check `qboInvoice.status === "Voided"` first. If true, mark ServiceOps invoice as CANCELLED and return. If false, check `Balance` for payment updates. Do not take any action on invoices that are in a state we already know about (e.g., if ServiceOps invoice is already PAID and QBO balance is 0, skip).

### Risk 4: `createdByUserId` requirement when creating new inbound customers

When `processInboundCustomer` creates a brand-new ServiceOps customer from QBO data (a customer that existed in QBO but not in ServiceOps), the Customer model may require `createdByUserId`. From the schema read, `Customer.createdByUserId` is `String? @db.Uuid` (nullable). This means the create will succeed without it. The `@relation` is also optional (using `?`). This is safe — confirm with schema read but likely no issue.

### Risk 5: SyncToken staleness in `processVoidInvoiceInQbo`

The `voidInvoice()` call requires the current QBO `SyncToken`. The function must call `getInvoice()` first to get the fresh SyncToken. This adds one extra QBO API call per void. If the invoice was updated in QBO between the `getInvoice` call and the `voidInvoice` call (in a concurrent-access scenario), QBO will return a 400 "Stale Object Error." The existing retry mechanism in `qbo-queue.ts` (`fail()` increments attempts and resets to pending up to 3 times) will handle this automatically — the job will retry and the next `getInvoice` will fetch the fresh SyncToken.

**No special handling needed** — the existing retry/dead-letter queue infrastructure handles this case.

### Risk 6: CDC poll interval vs. changedSince window drift

If the CDC cron fails for several consecutive runs (e.g., QBO is down for 6 hours), `lastPollAt` is not advanced. On recovery, the next CDC call will use a `changedSince` from 6+ hours ago. QBO CDC supports up to 30 days back, so this is safe. However, the CDC response could return a very large number of changes, potentially hitting QBO pagination limits.

QBO CDC returns up to 1,000 entities per entity type per CDC call. If more than 1,000 customers or invoices changed during the outage window, the response is truncated. QBO does not provide a continuation token for CDC — pagination must be simulated by calling CDC with a 30-day window sliced into smaller intervals.

For the GPS use case (small number of customers, few invoices), this is not a practical concern. Design the code to log a warning if `QueryResponse.maxResults` equals `QueryResponse.startPosition + entities.length` (which signals truncation) and include this in the return stats.

### Risk 7: Invoice void trigger must not fire when QBO itself initiates the void

If QBO voids an invoice and CDC delivers the change, `processCdcInvoiceChange` marks the ServiceOps invoice as CANCELLED. If the ServiceOps invoice is now CANCELLED, the next operation by a user might attempt to enqueue an `invoice:void` job — but the invoice is already voided in QBO. The `processVoidInvoiceInQbo` function must guard against this: if the QBO invoice is already voided (fetched via `getInvoice`, `status === "Voided"`), return success without calling `voidInvoice()` again.

---

## Dependency Graph

### Wave 1 — Foundation (no inter-Phase 4 dependencies)

1. **Add `status?: string` to `QboInvoice` in `qbo-types.ts`** — one-line fix. Must be first so all Phase 4 code can type-safely check for void status.

2. **Confirm `InvoiceStatus` enum has `CANCELLED`** — read schema, add if missing. If added: generate migration `add_invoice_status_cancelled`. If already present: no migration needed.

3. **New sync functions in `qbo-sync.ts`:**
   - `processInboundCustomer(orgId, qboCustomer, connectionId)` — depends on `fromQboCustomer` (mapper, already built)
   - `processCdcCustomerPull(orgId, qboCustomerId, realmId)` — thin wrapper that fetches QBO customer then calls `processInboundCustomer`
   - `processCdcInvoiceChange(orgId, qboInvoiceId, realmId)` — depends on `getInvoice` (client, already built)
   - `processVoidInvoiceInQbo(orgId, invoiceId)` — depends on `getInvoice` and `voidInvoice` (client, already built)

### Wave 2 — Cron routes (depend on Wave 1 sync functions)

4. **New cron: `src/app/api/cron/qbo-cdc/route.ts`** — depends on `cdcRequest` (client), `QboCdcCursor` (schema). Enqueues jobs but does NOT call the Wave 1 sync functions directly — it only enqueues to the queue.

5. **Extend `src/app/api/cron/qbo-flush/route.ts`** — add `invoice:pull`, `customer:pull`, `invoice:void` cases to `dispatchJob`. Depends on Wave 1 sync functions.

6. **Update `vercel.json`** — add `qbo-cdc` cron entry. No code dependencies.

### Wave 3 — Invoice cancellation trigger (depends on Wave 1 + 2)

7. **Wire void trigger in `src/app/api/invoices/[id]/route.ts`** — when status changes to `CANCELLED`, enqueue `invoice:void` job. Depends on Wave 2 flush handling the `invoice:void` case.

### Wave 4 — Tests (depend on all prior waves)

8. **Unit tests** for the four new sync functions and CDC parsing.
9. **Integration tests** for the CDC cron route and void flow.

---

## Validation Architecture

### PAY-02 — Invoice status bidirectional sync

**Unit test — void inbound:**
Mock `getInvoice` to return `QboInvoice` with `status: "Voided"`. Call `processCdcInvoiceChange(orgId, qboInvoiceId, realmId)`. Assert `prisma.invoice.update` called with `{ status: "CANCELLED" }` on the invoice matching `qboInvoiceId`. Assert QboSyncLog created with `action: "pull"`, `status: "success"`, `metadata: { source: "qbo_cdc", voided: true }`.

**Unit test — partial payment inbound:**
Mock `getInvoice` to return `QboInvoice` with `Balance: 250, TotalAmt: 500`. Call `processCdcInvoiceChange`. Assert invoice status is NOT changed. Assert QboSyncLog created with `metadata: { source: "qbo_cdc", remainingBalance: 250, note: "Partial payment" }`.

**Unit test — full payment via CDC:**
Mock `getInvoice` to return `QboInvoice` with `Balance: 0, status: undefined`. Call `processCdcInvoiceChange`. Assert invoice status updated to PAID. Assert paidAt set.

**Unit test — outbound void:**
Call `processVoidInvoiceInQbo(orgId, invoiceId)` where invoice has `qboInvoiceId`. Mock `getInvoice` to return `{ SyncToken: "5" }`. Mock `voidInvoice` to return `{ Id: qboInvoiceId, status: "Voided" }`. Assert `voidInvoice` was called with `(connection, qboInvoiceId, "5")`. Assert QboSyncLog created with `action: "void"`.

**Unit test — void already voided (guard):**
Mock `getInvoice` to return `{ status: "Voided" }`. Call `processVoidInvoiceInQbo`. Assert `voidInvoice` is NOT called. Assert success returned.

**Integration test — full round trip (manual):**
In QBO sandbox, create and sync an invoice. Void it in QBO. Wait for CDC poll (or trigger manually). Assert ServiceOps invoice status becomes CANCELLED. Separately: cancel an invoice in ServiceOps. Assert QBO invoice shows as Voided within 5 minutes (next flush cycle).

### SYNC-01 — CDC polling engine

**Unit test — cursor creation:**
Mock `prisma.qboConnection.findMany` to return one connection with no `cdcCursors`. Mock `cdcRequest` to return empty CDC response. Call the cron handler. Assert `prisma.qboCdcCursor.upsert` was called with `create` path (first run). Assert `lastPollAt` is set to approximately `now`.

**Unit test — cursor advance:**
Mock connection with existing cursor `lastPollAt = T`. Mock `cdcRequest` to return 2 changed customers and 1 changed invoice. Call cron. Assert `cdcRequest` was called with `changedSince = T`. Assert `prisma.qboCdcCursor.upsert` called with `update: { lastPollAt: <new>, lastPollStatus: "success" }`. Assert `enqueue` called 3 times (2 customer:pull + 1 invoice:pull).

**Unit test — cursor NOT advanced on failure:**
Mock `cdcRequest` to throw. Assert `lastPollAt` is NOT updated. Assert `lastPollStatus = "failed"` and `lastPollError` is set.

**Unit test — multi-org isolation:**
Mock 3 connections; second one's `cdcRequest` throws. Assert first and third orgs' cursors are advanced. Assert second org's cursor shows failure. Assert `stats.errors === 1`.

**Manual validation:**
Call `GET /api/cron/qbo-cdc` with correct `Authorization: Bearer <CRON_SECRET>`. Assert 200 response with `{ data: { orgsPolled: 1, customersQueued: N, invoicesQueued: M, errors: 0 } }`. Check `QboCdcCursor` row in DB: `lastPollAt` advanced, `lastPollStatus = "success"`. Check `QboSyncJob` table: new `customer:pull` and `invoice:pull` jobs created.

### SYNC-02 — Customer inbound sync

**Unit test — update existing customer (QBO ID match):**
Mock `prisma.customer.findFirst` to return existing customer with `qboCustomerId = "qbo-123"`. Mock QBO customer data with updated billing address. Call `processInboundCustomer`. Assert `prisma.customer.update` called with new billing fields. Assert `name`, `primaryEmail`, `primaryPhone`, `billingStreet1-4` updated. Assert CRM fields (`tier`, `assignedToUserId`) NOT in update payload.

**Unit test — create new customer from QBO:**
Mock `prisma.customer.findFirst` to return null (not found by QBO ID or email). Call `processInboundCustomer`. Assert `prisma.customer.create` called with `qboCustomerId` set, name and billing fields from `fromQboCustomer()`.

**Unit test — email fallback match:**
Mock: findFirst by QBO ID returns null; findFirst by email returns existing customer. Assert `update` is called (not `create`). Assert `qboCustomerId` is written back to the found customer record.

**Unit test — inactive QBO customer does not deactivate ServiceOps customer:**
Mock QBO customer with `Active: false`. Assert ServiceOps `status` field is NOT changed to inactive.

**Unit test — conflict logging:**
Mock an update scenario. Assert QboSyncLog metadata contains `{ source: "qbo_cdc", fieldsUpdated: ["name", "billingCity"] }`.

---

## Open Questions for CONTEXT.md / Planning

1. **Does `InvoiceStatus` enum include `CANCELLED`?** Read the full enum block in `prisma/schema.prisma` before writing plans. If absent, a one-line addition is needed and the migration must be Wave 1, Plan 1.

2. **Should CDC also poll `Payment` entities?** The requirement says "all changed entities" for SYNC-01 but we have a webhook for payments already. Recommendation: no — polling `Payment` via CDC creates double-processing risk. CDC should only cover `Customer` and `Invoice` for Phase 4.

3. **What should `processInboundCustomer` use for `createdByUserId` when creating a new inbound customer?** The `Customer` model schema shows `createdByUserId String? @db.Uuid` is nullable, so this is not a blocker — just pass `null` or omit it and include a log note that the record was created by QBO CDC sync.

4. **Should the CDC cron immediately process entities inline, or always enqueue to `qbo-flush`?** Recommendation: always enqueue. This keeps the CDC cron fast (under Vercel's timeout), leverages the existing retry infrastructure, and is consistent with the architecture. The only trade-off is up to 5-minute additional delay between CDC poll and customer record update.

5. **Is there a QBO-side indicator that distinguishes "updated via ServiceOps push" from "updated natively in QBO"?** No — QBO has no source tagging. This is why the field-ownership split is the correct conflict resolution strategy rather than "last writer wins."

---

*Research written: 2026-03-09*
*Phase: 04-inbound-sync*
