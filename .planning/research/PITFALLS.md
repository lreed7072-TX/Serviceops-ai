# Pitfalls Research: QBO Integration

*Context: ServiceOpsIQ — 19-point QBO integration expansion on top of existing OAuth + customer/invoice sync. Stack: Next.js serverless (Vercel), Prisma, Supabase PostgreSQL.*

---

## Critical Pitfalls (Will Break Production)

### 1. Refresh Token Expiry Is a Hard 100-Day Cliff

**What QBO does:** The refresh token expires exactly 100 days after it was last used. Unlike the access token (1-hour expiry), the refresh token does NOT silently extend on use — it only resets when you successfully call the token endpoint and get a new refresh token back. If an org's QBO connection sits idle (no sync activity) for 100 days, the refresh token is permanently dead. The org must re-authorize from scratch.

**Warning signs:**
- Error: `"Token has expired"` or HTTP 401 from the token endpoint (not from the API endpoint)
- QBO returns `"error": "invalid_grant"` on the refresh call

**Prevention:**
- Store `refreshTokenExpiry` on `QboConnection` (current schema likely does not have this). Calculate it as `issued_at + 100 days`.
- Build a nightly cron job that proactively refreshes tokens for any connection whose refresh token expires within 14 days, even if no sync has run recently.
- On any `invalid_grant` error during refresh, immediately mark `QboConnection.isActive = false` and send an in-app alert + email to the org admin with a re-connect link.
- Never silently swallow a 401 from the token endpoint — it means the connection is dead.

**Phase:** Address in Phase 1 (token management hardening) before any new sync points are built.

---

### 2. SyncToken Conflicts on Concurrent Updates

**What QBO does:** Every mutable QBO entity (Customer, Invoice, Bill, Item, etc.) carries a `SyncToken` integer. Any POST update must include the entity's current `SyncToken`. If QBO's copy has been modified since you last fetched (by a user in the QBO web UI, another app, or a webhook-triggered update), your update is rejected with HTTP 400 and `"Stale Object"` or `"Business Validation Error: Stale Object"`.

**Current code gap:** `updateCustomer()` in `qbo-client.ts` fetches the entity first to get `SyncToken` — this is correct but creates a read-then-write window. In a serverless environment with concurrent invocations, two functions can both read `SyncToken: 5`, then both try to write — one succeeds and increments to `6`, the other fails with a stale error.

**Warning signs:**
- QBO returns HTTP 400 with message containing `"Stale"` or `"6000"` (QBO error code for stale object)
- Intermittent failures on update operations that succeed on retry

**Prevention:**
- Wrap all update operations in a retry loop: fetch fresh entity, extract current `SyncToken`, attempt update; on stale error, retry up to 3 times with exponential backoff (500ms, 1000ms, 2000ms).
- Never cache `SyncToken` values in your database — always fetch fresh before every write.
- Use database-level locking (`SELECT FOR UPDATE` on the local entity) to serialize concurrent sync operations for the same entity.
- Log `SyncToken` mismatches as warnings so you can identify whether QBO users are editing records directly.

**Phase:** Address in every sync phase — build a `qboUpdateWithRetry()` wrapper in `qbo-client.ts` before writing any new update operations.

---

### 3. DisplayName Uniqueness Is Global Within a Realm

**What QBO does:** `Customer.DisplayName`, `Item.Name`, `Vendor.DisplayName`, and `Employee.DisplayName` must each be unique within the QBO realm — not just within their entity type. A Customer named "Smith Contracting" and a Vendor named "Smith Contracting" cannot coexist. QBO returns HTTP 400 with error code `"6240"` or `"Duplicate Name Exists Error"` on create.

**Warning signs:**
- HTTP 400 with message containing `"Duplicate"` or `"6240"`
- Failures specifically on customer/vendor creates, not updates

**Prevention:**
- Before creating any named entity, query QBO for existing records with the same name: `SELECT * FROM Customer WHERE DisplayName = 'X'` via the QBO query endpoint.
- Build a name collision resolution strategy: append the ServiceOps internal ID suffix (e.g., `"Smith Contracting [SO-4421]"`) when a duplicate is detected, rather than failing.
- For customers, if a duplicate is found, offer the user the option to link to the existing QBO record rather than creating a new one (this is also the correct UX for the inbound customer sync feature).
- Apply this check to all entity types with name fields: Customer, Vendor, Item/Service, Employee.

**Phase:** Address before Customer inbound sync and Item/Service sync are implemented.

---

### 4. Invoice Lines Must Reference Valid Items — Not Just Text

**What QBO does:** Invoice line items with `DetailType: "SalesItemLineDetail"` must reference a valid `ItemRef` that exists in the QBO chart of items. The current `createInvoice()` in `qbo-client.ts` sends line items without `ItemRef`, which QBO will either reject or silently assign to a generic item. In production accounts, QBO often requires an `ItemRef` to properly post revenue to the correct income account.

**Warning signs:**
- Invoices are created but income doesn't post to the correct account in P&L reports
- QBO returns `"Missing ItemRef"` or the invoice posts to Uncategorized Income

**Prevention:**
- Implement Item/Service sync before any invoice sync expansion. Every ServiceOps line item type (labor, materials, travel, etc.) must map to a QBO Item.
- Store the `qboItemId` on your ServiceOps item/service records after sync.
- The account mapping UI (Chart of Accounts pull) must be completed before Item sync — users need to choose which income account each item type maps to.
- For the `DescriptionOnlyLine` DetailType (text-only lines), no ItemRef is needed, but these don't post to accounts — use only for notes/headers, not billable items.

**Phase:** Item/Service sync must be completed before invoice line item enrichment. This is a prerequisite dependency that must be sequenced correctly in the roadmap.

---

### 5. Webhook Delivery Is Not Guaranteed and Has a 5-Minute Minimum Delay

**What QBO does:** QBO webhook events are batched and delivered with a minimum ~5-minute delay from the triggering action. Events can arrive out of order (an Update before a Create for the same entity). Events can be delivered more than once. QBO expects your endpoint to return HTTP 200 within 30 seconds or it will retry — potentially delivering the same event multiple times.

**Current code gap:** The webhook handler in `qbo-sync.ts` is not idempotent. It processes Payment Create events and logs them, but if the same event is delivered twice, it will log twice. More critically, the handler does synchronous QBO API calls inside the webhook response window — fetching a payment's details inline would take 1-3 seconds and could fail, causing the webhook to retry.

**Warning signs:**
- Duplicate `QboSyncLog` entries for the same `qboEntityId` + `action`
- Webhook endpoint occasionally returning non-200 (visible in QBO developer dashboard)
- Payment status updates being applied twice

**Prevention:**
- Implement a webhook deduplication table: store `(realmId, entityType, entityId, operationType, deliveredAt)` with a unique constraint. On receipt, attempt an INSERT; if it violates the unique constraint, return 200 immediately without processing (already handled).
- Make the webhook handler return 200 immediately, then enqueue all processing work to a background queue. On Vercel, use `waitUntil()` from the edge runtime, or write to a `WebhookQueue` Prisma table and process via a separate cron.
- Never make synchronous QBO API calls inside the webhook handler body — always defer.
- Reconcile via CDC polling rather than relying solely on webhooks for correctness.

**Phase:** Fix before completing payment webhook processing (first active requirement).

---

### 6. Void vs. Delete — QBO Does Not Allow Hard-Delete of Posted Transactions

**What QBO does:** Invoices, bills, and payments that have been posted cannot be deleted — they can only be voided. A voided invoice still exists with `$0` balance and `"VOIDED"` status. If you call DELETE on a posted invoice, QBO returns an error. Deleting an unposted invoice (draft) works. The distinction matters because your sync logic must handle `VOIDED` as a valid status, not a missing entity.

**Warning signs:**
- Attempting to delete a synced invoice from ServiceOps fails with a QBO error
- CDC inbound sync receives an entity with `Active: false` and your code treats it as "deleted"

**Prevention:**
- Map your internal cancel/void action to QBO's void operation (`POST /invoice/{id}?operation=void`), never to DELETE.
- In CDC inbound sync, treat `Active: false` as "voided/inactive" and update the local record's status accordingly — do not delete the local record.
- Add `qboStatus` field to Invoice and Customer models to store QBO's view of the status independently from ServiceOps status.
- Document for users that voided QBO invoices will appear in ServiceOps as cancelled, not deleted.

**Phase:** Address in invoice status bidirectional sync phase.

---

## Common Mistakes (Will Cause Bugs)

### 7. Token Refresh Race Condition in Concurrent Serverless Functions

**What happens:** Two serverless function invocations for the same org both find the access token expired at the same millisecond. Both call `refreshAccessToken()`. Both succeed, each getting a different new access token and refresh token. The second one to write to the database wins. The first one's refresh token is now invalid (QBO refresh tokens are single-use). The next refresh attempt with the stale token fails with `invalid_grant`.

**Current code gap:** `getValidAccessToken()` in `qbo-client.ts` has this exact race — no locking exists between the expiry check and the database write.

**Prevention:**
- Use a database advisory lock or Postgres `SELECT FOR UPDATE SKIP LOCKED` to serialize token refresh for the same `connectionId`.
- Add a `refreshInProgress` boolean flag to `QboConnection` and use optimistic locking: only attempt refresh if you can atomically set `refreshInProgress = true` where it was `false`.
- Cache the current access token in memory for the duration of a single function invocation (pass it as a parameter rather than re-fetching from DB on every sub-call within the same request).

**Phase:** Fix immediately — this is a latent bug in the existing code.

---

### 8. Decimal Precision Mismatches Between Prisma Decimal and QBO Float

**What happens:** QBO stores monetary amounts as JSON numbers (floating point). Prisma's `Decimal` type uses arbitrary precision. When you convert `item.totalPrice` (Prisma `Decimal`) via `Number()` as in the current `syncInvoiceToQbo()`, you can introduce floating-point errors. A value stored as `123.456789` in Prisma could become `123.45678900000001` in the QBO payload. QBO may reject or round amounts silently.

**Warning signs:**
- Invoice totals in QBO don't match ServiceOps to the cent
- QBO returns validation errors on line amounts

**Prevention:**
- Always round to 2 decimal places before sending to QBO: `Math.round(Number(price) * 100) / 100`
- Better: use `.toFixed(2)` and parse back: `parseFloat(Number(price).toFixed(2))`
- Validate that the sum of line item amounts equals the invoice total before pushing — QBO may auto-recalculate and produce a mismatch.
- Store QBO-returned amounts back in your sync log so you can audit for drift.

**Phase:** Fix in the existing invoice sync, then apply the pattern to all new money-bearing entity syncs (Bills, POs, TimeActivity rates).

---

### 9. QBO "Sparse Update" Behavior — Omitted Fields Are Cleared

**What QBO does:** A full update (POST with the entity body) replaces all fields. If you omit `PrimaryPhone` from an update payload, QBO clears the phone number on the entity. This is not a PATCH — it is a full replacement. The current `updateCustomer()` only sends `DisplayName` and optionally `PrimaryEmailAddr`, so every customer update currently clears the phone, billing address, and all other fields.

**Warning signs:**
- Customer data in QBO gets progressively stripped after each sync
- Users report that QBO records are losing phone numbers and addresses

**Prevention:**
- Always fetch the full entity first, merge your changes into the full payload, then POST the complete merged object.
- Build a helper `mergeQboEntity(existing, changes)` that starts with the full QBO object and applies only the fields you intend to change.
- Never construct a QBO update payload from only your local data — always start from QBO's current representation.
- This applies to every entity type: Customer, Invoice, Item, Vendor, Employee.

**Phase:** Fix in existing `updateCustomer()` immediately — this is a live data corruption bug.

---

### 10. CustomerRef Validation — QBO Validates References at Write Time

**What happens:** When creating an Invoice, QBO validates that `CustomerRef.value` points to an active (non-deleted, non-inactive) customer. If the customer was made inactive in QBO between your customer sync and your invoice sync, the invoice creation fails with a reference validation error. Similarly, `ItemRef` values on line items must point to active items.

**Warning signs:**
- Invoice sync fails with `"Invalid Reference Id"` or `"6000: A business validation error has occurred"` despite the customer being synced

**Prevention:**
- Before every invoice push, verify the QBO customer is still active: `GET /customer/{id}` and check `Active: true`.
- Handle the inactive-customer case gracefully: reactivate the QBO customer (set `Active: true` via update), or surface a clear error to the user with a link to QBO to investigate.
- Store a `qboActive` boolean on synced entities so you can query for entities that may need reactivation before pushing related records.

**Phase:** Address during invoice sync hardening and estimate sync phases.

---

### 11. QBO Query Language (SQL-Like) Has Strict Limitations

**What QBO does:** The QBO query endpoint uses a SQL-like syntax (`SELECT * FROM Invoice WHERE ...`) but it is NOT real SQL. It supports only a small subset of operators, no JOINs, no subqueries, limited WHERE conditions, and a hard maximum of 1000 results per query. The `LIKE` operator is supported but `%` wildcards only work at the end of the string (prefix matching only, not contains).

**Warning signs:**
- Queries that work in sandbox return zero results or errors in production
- Queries for "contains" text fail with a parse error

**Prevention:**
- Use `STARTSWITH` or prefix `LIKE 'Smith%'` patterns only — never `LIKE '%Smith%'`.
- Always include `MAXRESULTS 1000` and implement pagination with `STARTPOSITION` for any query that might return more than 100 results.
- For CDC, use `SELECT * FROM Invoice WHERE Metadata.LastUpdatedTime > 'timestamp'` — test this exact pattern in sandbox before shipping.
- Never construct QBO query strings with user-provided input without escaping single quotes (SQL injection risk in QBO's query parser, even if the blast radius is limited).

**Phase:** Address when implementing CDC inbound sync and QBO Reports API.

---

### 12. Estimate-to-Invoice Conversion Must Go Through QBO, Not Be Recreated

**What QBO does:** QBO has a native Estimate → Invoice conversion that preserves the link between the two documents (visible in QBO UI and reports). If you sync an Estimate to QBO and then separately create an Invoice from the same data, QBO sees them as unrelated documents. The converted invoice in QBO has `LinkedTxn` references back to the estimate; a separately created invoice does not.

**Prevention:**
- When a ServiceOps quote is accepted and converted to an invoice, use the QBO `invoice` endpoint with `LinkedTxn: [{ TxnId: estimateQboId, TxnType: "Estimate" }]` to create the invoice from the estimate.
- Alternatively, use QBO's built-in conversion: `POST /estimate/{id}?operation=link` to an invoice.
- Never create a standalone invoice in QBO for a record that has a corresponding synced estimate.
- Store `qboEstimateId` on the ServiceOps quote and use it when the quote converts to an invoice.

**Phase:** Address during Estimate sync phase, before invoice sync expansion.

---

### 13. Time Activity Sync Requires Employee Records in QBO

**What QBO does:** `TimeActivity` entities in QBO require an `EmployeeRef` (or `VendorRef` for contractors) that points to an existing QBO Employee or Vendor. You cannot create a TimeActivity with just a name string. Additionally, QBO's `TimeActivity` requires a `CustomerRef` AND either an `ItemRef` (service item) or a class, and the company must have time tracking enabled in QBO settings.

**Warning signs:**
- TimeActivity creates fail with `"Missing EmployeeRef"` or `"Employee not found"`
- Time tracking is enabled in your app but the QBO company hasn't enabled it

**Prevention:**
- Employee sync must be completed and verified before TimeActivity sync is attempted — this is a hard prerequisite.
- Add a preflight check: before attempting TimeActivity sync, verify via `GET /preferences` that `TimeTrackingPrefs.MarkExpensesBillable` is configured.
- Handle the case where a ServiceOps tech is not yet synced to QBO: queue the TimeActivity for sync after employee sync completes rather than failing.
- Technicians must be synced as QBO Employees (W-2) or Vendors (1099/contractor) — determine this mapping upfront with the user; it affects payroll.

**Phase:** Employee sync must be gated before TimeActivity sync in the implementation sequence.

---

### 14. Recurring Invoice Templates Have No Direct API Support in QBO

**What QBO does:** QBO's recurring transactions (templates) are a UI-only feature — there is no API endpoint to create, read, or manage recurring templates. The QBO REST API does not expose recurring transaction objects. You cannot programmatically create a recurring invoice template via the API.

**Warning signs:**
- Searching for `RecurringTransaction` in QBO API docs returns no REST endpoint
- Intuit forums confirm this limitation as of 2025

**Prevention:**
- The "Recurring invoice templates for maintenance contracts" requirement must be implemented entirely within ServiceOps, not by pushing to QBO's native recurring feature.
- ServiceOps generates actual invoices on schedule (via the existing PM cron pattern) and pushes each generated invoice to QBO as a regular invoice.
- Communicate this to users: recurring templates are managed in ServiceOps, QBO receives the resulting invoices.
- Update the PROJECT.md requirement description to clarify that "recurring invoice templates" means ServiceOps-managed scheduling, not QBO recurring templates.

**Phase:** Clarify in planning before scoping the recurring invoices feature. No QBO API work needed — this is a ServiceOps cron + invoice push.

---

## Edge Cases (Will Surprise You)

### 15. Sandbox and Production Behave Differently in Key Ways

**Specific differences:**
- Sandbox has pre-populated test data (sample customers, items) that can collide with your creates.
- Sandbox does not enforce all validation rules that production enforces (some errors only appear in production).
- Sandbox webhook events are delayed differently and may arrive in minutes; production can be immediate or delayed by hours under load.
- Sandbox realmIds are numeric strings starting with `4620816365` — very different format from production.
- The QBO CDN for OAuth redirects behaves differently in sandbox (allows localhost); production requires HTTPS non-localhost.
- Rate limits in sandbox are more permissive and do not accurately reflect production throttling.

**Prevention:**
- Test every new sync point against a fresh sandbox company (no pre-existing data) to simulate a new user experience.
- Run a production smoke test with a real QBO account (use a dedicated test company in production, not sandbox) before shipping each phase.
- Do not assume that sandbox success means production success — always test the name uniqueness, reference validation, and tax handling paths in production.

---

### 16. Class and Location Tracking Must Be Enabled Per-Company in QBO

**What QBO does:** `ClassRef` and `DepartmentRef` (Location) on transactions only work if the QBO company has Class Tracking and/or Location Tracking enabled in QBO Account and Settings. If not enabled, QBO silently ignores these fields on write but does not error. Reading them back will show null.

**Warning signs:**
- Class/Location fields are being sent but QBO transactions show no class assignment
- No error is returned but reporting shows unclassified transactions

**Prevention:**
- Check `GET /preferences` before syncing any Class or Location references. The response includes `AccountingInfoPrefs.ClassTrackingPerTransaction` and `AccountingInfoPrefs.DepartmentTrackingPerTransaction`.
- Surface this as a configuration status in the integration dashboard ("Class Tracking: Enabled / Disabled in QBO").
- If tracking is disabled, omit the fields rather than sending null values, and show a warning in the UI that class assignment will not sync until enabled in QBO.

**Phase:** Address during Class tracking and Location/Department tracking phases.

---

### 17. QBO Rate Limiting Returns 429 With a Retry-After Header, But Batch Endpoint Has Different Limits

**What QBO does:** Standard API: 500 requests per minute per realm, 10 concurrent. The Batch API (`/batch`) allows up to 30 operations per request but counts as 30 requests against the rate limit — not 1. The error for exceeding the limit is HTTP 429 with `Retry-After` in seconds (typically 60).

**Warning signs:**
- HTTP 429 errors during bulk sync operations
- Sync succeeds for small datasets but fails for orgs with 100+ customers

**Prevention:**
- Implement an exponential backoff retry that reads the `Retry-After` header and waits that duration before retrying.
- Track requests-per-minute in memory within a function invocation; if approaching 450 requests, introduce a voluntary delay.
- For bulk operations (initial import, full re-sync), use the Batch API to reduce call volume but stay within the 30-operation limit per batch request.
- Build the sync queue so that it can be paused and resumed — if a sync job hits rate limits, it should save progress and continue on the next cron run rather than failing the entire job.

---

### 18. CDC Returns Deleted Entities Only if You Query Within 30 Days

**What QBO does:** Change Data Capture (`/cdc`) returns changes since a given timestamp. However, deleted/voided entities are only included in CDC results for 30 days after deletion. After 30 days, if your last CDC poll was more than 30 days ago (e.g., due to a connectivity issue or disabled integration), deleted entities will be invisible in the CDC response and your local data will be stale.

**Warning signs:**
- Local records exist for entities that no longer exist in QBO
- CDC poll finds no changes but QBO data differs from local data

**Prevention:**
- Ensure CDC polling runs at least every 24 hours (use the existing PM cron infrastructure).
- If a CDC poll is missed for more than 7 days (alert threshold), trigger a full reconciliation rather than a delta sync for the affected entity types.
- Store `lastCdcPollAt` on `QboConnection` and alert if it exceeds 72 hours.
- After a full re-sync, do a diff between local records and QBO records to identify orphaned local records that no longer exist in QBO.

---

### 19. Tax Handling: QBO Has Multiple Tax Systems That Cannot Be Mixed

**What QBO does:** QBO US accounts can use either: (a) the legacy manual tax system (`TxnTaxDetail` with explicit tax rates), or (b) Automated Sales Tax (AST) managed by Intuit. These are mutually exclusive per company. If the company uses AST and you send `TxnTaxDetail`, QBO ignores your tax lines and calculates tax automatically. If the company uses manual tax and you send nothing, the invoice is tax-exempt. You cannot detect which system is in use from the invoice response alone.

**Warning signs:**
- Invoices arrive in QBO with different tax amounts than ServiceOps shows
- Tax lines sent in the payload are silently ignored

**Prevention:**
- Call `GET /preferences` and check `TaxPrefs.UsingSalesAndPurchaseTax` and `TaxPrefs.TaxGroupCodeRef` to detect which tax system the company uses.
- For AST companies: omit `TxnTaxDetail` entirely and set `TaxCode: { value: "TAX" }` on taxable line items; let QBO calculate the tax.
- For manual tax companies: include `TxnTaxDetail` with the correct `TaxRateRef`.
- Build the tax handling branch as a strategy pattern keyed on the detected tax system — do not try to handle both in a single code path.
- Show the detected tax mode in the integration dashboard.

**Phase:** Address before any invoice that includes tax is synced. Tax handling is foundational to invoice correctness.

---

### 20. `minorversion` Parameter Determines Available Fields

**What QBO does:** The QBO REST API v3 is versioned by the `minorversion` query parameter. Newer minor versions expose additional fields, fix bugs, and occasionally change behavior. The current code appends `minorversion` — verify which version is being sent. Some fields critical for the planned features (e.g., `GlobalTaxCalculation`, `LinkedTxn`, `RecurringInfo`) require specific minor versions.

**Prevention:**
- Pin a specific `minorversion` (currently recommend `minorversion=73` as of 2025) across all requests in `qboRequest()` — do not let it vary per call.
- Document the pinned version in `qbo-client.ts` as a named constant with a comment explaining what version is required and why.
- When Intuit releases new minor versions, test in sandbox before bumping.
- Check the QBO release notes for the minor version when implementing each new entity type.

---

## Serverless-Specific Pitfalls

### 21. Bulk Sync Jobs Will Time Out in Vercel Serverless Functions

**What happens:** Vercel serverless functions have a default 10-second execution limit (60-second max on Pro). An initial sync of 500 customers to QBO — each requiring a GET (check existing) + POST (create) plus a DB write — at 200ms per operation = 200 seconds. This will always time out.

**Prevention:**
- Never run bulk sync inline in an API route response. Always write sync jobs to a queue table and process via cron.
- The sync queue should process in batches of 25-50 entities per cron invocation, staying well within the 60-second limit.
- Use Vercel's `maxDuration` config in route config to set 60s on cron routes, not on user-facing API routes.
- For user-triggered "Sync All" operations, immediately return `202 Accepted` and a job ID; poll for completion via a separate status endpoint.
- Track sync progress in the `QboSyncLog` table so a timed-out job can resume where it left off on the next cron tick.

---

### 22. Webhook Endpoint Must Return 200 Before Processing Completes

**What happens:** The QBO webhook expects HTTP 200 within 30 seconds. Vercel serverless function timeout applies. If processing (fetching payment details from QBO, updating the local DB) takes longer than 30 seconds — or if it throws — QBO gets a non-200 response and retries, potentially causing duplicate processing.

**Current code gap:** The existing webhook handler in `qbo-sync.ts` does synchronous processing inside the request handler. It currently only logs, so it's fast — but as soon as you add actual QBO API calls to fetch payment details, this will become a timeout risk.

**Prevention:**
- Return `NextResponse.json({ received: true }, { status: 200 })` immediately at the top of the webhook handler.
- Use `waitUntil()` (available in Vercel Edge Runtime) to run processing after the response is sent: `context.waitUntil(processWebhookAsync(payload))`.
- Alternatively, write the raw webhook payload to a `WebhookQueue` table and process via cron — simpler and more reliable.
- Always deduplicate (Pitfall #5) before enqueuing to avoid processing the same event twice.

---

### 23. No Persistent In-Memory State — Every Request Is Cold

**What happens:** Serverless functions have no shared memory between invocations. Rate limit counters, in-flight sync state, and token caches cannot be stored in module-level variables (they reset on each cold start). Any state that needs to persist across requests must live in the database or an external cache.

**Prevention:**
- Store all sync state — `lastCdcPollAt`, `syncInProgress`, `rateLimitResetAt` — on the `QboConnection` model in the database.
- Use a `QboSyncLock` table with a TTL-based row to prevent two concurrent cron invocations from both attempting the same sync job.
- Do not implement in-memory rate limit tracking; use the database or accept that each serverless invocation starts fresh and rely on QBO's 429 response as the signal.

---

### 24. Vercel Cron Is Not Guaranteed Exactly-Once

**What happens:** Vercel cron jobs can fire more than once if there is a platform hiccup (deploy in progress, function timeout causes retry). The existing `generate-pms` cron is also subject to this. If two cron invocations both start a CDC poll at the same time, they can process the same changes twice.

**Prevention:**
- Use the `QboSyncLock` pattern: at the start of every cron-triggered sync, attempt to INSERT a lock row with a unique key + expiry. If the INSERT fails (row exists), abort the run. The lock row is deleted at the end of the run or expires after a TTL (e.g., 5 minutes) to handle crashes.
- All sync operations must be idempotent by design — even if run twice, the second run should detect the already-synced state and skip.
- Check `qboSyncedAt` and `qboEntityId` fields before re-syncing any entity.

---

## Prevention Checklist

Build these into your implementation before or during each phase:

**Token Management (Phase 1 prerequisite):**
- [ ] Add `refreshTokenExpiry` column to `QboConnection` model
- [ ] Build proactive refresh cron: warn at 14 days, force at 7 days before expiry
- [ ] On `invalid_grant` error: mark connection inactive, alert admin, do not retry
- [ ] Add database-level mutex for token refresh to prevent race conditions
- [ ] Add `lastCdcPollAt` and `syncInProgress` columns to `QboConnection`

**Update Safety (Every phase):**
- [ ] Build `qboUpdateWithRetry(fn, maxRetries=3)` wrapper before any new update operations
- [ ] Never cache SyncToken; always fetch fresh entity before every update
- [ ] Always merge changes into the full fetched entity payload (do not send partial objects)
- [ ] Round all monetary values to 2 decimal places before sending to QBO

**Entity Prerequisites (Sequencing):**
- [ ] Chart of Accounts pull before any account mapping
- [ ] Item/Service sync before Invoice line item enrichment
- [ ] Customer sync verified active before Invoice push
- [ ] Employee sync before TimeActivity sync
- [ ] Estimate sync with qboEstimateId stored before Invoice conversion sync

**Webhook Hardening:**
- [ ] Deduplication table with unique constraint on (realmId, entityId, operationType, eventTimestamp)
- [ ] Return 200 immediately; defer all processing via waitUntil() or WebhookQueue table
- [ ] Never make inline QBO API calls inside the webhook response path

**Name Collision Defense:**
- [ ] Query-before-create on all entity types with unique name constraints
- [ ] Name collision resolution strategy (suffix or link-to-existing) implemented before first create attempt
- [ ] Applies to: Customer, Vendor, Item, Employee

**Configuration Preflight Checks:**
- [ ] `GET /preferences` for tax system detection before any invoice with tax is synced
- [ ] `GET /preferences` for Class/Location tracking before sending ClassRef or DepartmentRef
- [ ] `GET /preferences` for time tracking before TimeActivity sync
- [ ] Surface all detected QBO settings in integration dashboard

**Bulk Sync Architecture:**
- [ ] All bulk operations go through the sync queue table, processed by cron
- [ ] Sync queue supports resume from last processed entity (store cursor in QboConnection)
- [ ] User-triggered syncs return 202 + job ID immediately
- [ ] SyncLock row pattern to prevent concurrent cron double-runs

**Rate Limiting:**
- [ ] Retry loop with Retry-After header respect on all API calls
- [ ] Batch API used for bulk initial syncs (max 30 ops per batch)
- [ ] Voluntary request throttling for bulk operations (stay under 450 req/min)

**CDC Inbound Sync:**
- [ ] Minimum 24-hour polling interval enforced
- [ ] Alert if lastCdcPollAt exceeds 72 hours
- [ ] Full reconciliation triggered if poll gap exceeds 7 days
- [ ] `Active: false` entities treated as voided, not deleted; local records updated, not deleted

**Data Integrity:**
- [ ] `qboStatus` field on Invoice and Customer for QBO's independent view of status
- [ ] Void (not delete) synced invoices in QBO on ServiceOps cancellation
- [ ] Recurring invoices: managed by ServiceOps cron + pushed as regular invoices (no QBO recurring template API)
- [ ] `minorversion` pinned as named constant in qbo-client.ts

---

*Last updated: 2026-03-07*
*Covers: 19 QBO integration points in PROJECT.md*
