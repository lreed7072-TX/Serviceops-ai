# Summary: Plan 03-03 — API routes: webhook rewrite, send-invoice-email, health/logs/trigger, qbo-flush cron

## Execution Date
2026-03-09

## Tasks Completed (7/7)

### 03-03-01: Rewrite webhook route as thin dispatcher
- **Commit**: `69e6dec`
- **File**: `src/app/api/integrations/qbo/webhook/route.ts` (modified)
- Completely rewrote POST handler as thin dispatcher — returns 200 in <50ms
- Maps entity names (Payment, Invoice, Customer, Item, Estimate) to entityType lowercase
- Maps operations to actions: Payment always "pull", Create → "push", Update/Delete → "pull"
- Dedup check: skips if pending/claimed job exists for same (qboEntityId, entityType)
- Enqueues to QboSyncJob with qboEntityId + qboRealmId for dedup on subsequent deliveries
- **No QBO API calls** — only signature verify, JSON parse, DB reads, DB writes
- Removed `handleQboPaymentWebhook` import — webhook no longer calls sync functions

### 03-03-02: Create send-invoice-email API endpoint
- **Commit**: `f2e53b1`
- **File**: `src/app/api/integrations/qbo/send-invoice-email/route.ts` (created)
- POST endpoint with auth, validates invoice exists and has qboInvoiceId
- Calls `sendInvoiceEmail()` from qbo-client (Content-Type: application/octet-stream)
- Logs email action to QboSyncLog with sentTo and emailStatus metadata
- Returns 400 when invoice not synced, 404 when not found, 500 on QBO error

### 03-03-03: Create health API endpoint
- **Commit**: `3e4aa6e`
- **File**: `src/app/api/integrations/qbo/health/route.ts` (created)
- GET endpoint returns comprehensive health data:
  - Connection status (realmId, companyName, token expiry)
  - Per-entity sync stats (customer, invoice, item, estimate, payment) with success/failed counts and last sync timestamp
  - Queue stats (pending, claimed, dead_letter, completed counts)
- All queries scoped to orgId via auth

### 03-03-04: Create sync-logs API endpoint with resolution hints
- **Commit**: `3609f0b`
- **File**: `src/app/api/integrations/qbo/sync-logs/route.ts` (created)
- GET endpoint with pagination (limit/offset) and filters (status, entityType)
- 9 error pattern → resolution hint mappings:
  - Business Validation Error, Stale Object Error, Duplicate Name, Account mapping, token refresh, invalid_grant, Rate Limit, No connection, not found
- Each log entry includes a `resolutionHint` field with actionable fix instructions
- Defaults to status="failed" filter (shows errors by default)

### 03-03-05: Create sync-trigger API endpoint for manual sync
- **Commit**: `c423aae`
- **File**: `src/app/api/integrations/qbo/sync-trigger/route.ts` (created)
- POST endpoint, ADMIN role only (returns 403 for non-ADMIN)
- Supports 4 entity types: customers, invoices, items, estimates
- Enqueues jobs with priority 1 (user-triggered, processed first)
- For items: enqueues both materials (qboItemId: null, isActive: true) and labor rates (qboItemId: null)
- Returns count of enqueued jobs

### 03-03-06: Create qbo-flush cron route
- **Commit**: `79cb405`
- **File**: `src/app/api/cron/qbo-flush/route.ts` (created)
- GET endpoint secured with CRON_SECRET (same pattern as generate-pms)
- 3-step processing: reset stale locks (120s) → claim batch (30 jobs) → dispatch sequentially
- Dispatches by `entityType:action` key:
  - customer:push → syncCustomerToQbo
  - invoice:push → syncInvoiceToQbo
  - item:push → syncMaterialToQbo or syncLaborRateToQbo (based on payload.sourceType)
  - estimate:push → syncQuoteToQbo
  - payment:pull → processPaymentJob (uses qboEntityId + realmId from payload)
- Returns stats: { resetStale, processed, succeeded, failed }

### 03-03-07: Add qbo-flush cron to vercel.json
- **Commit**: `51aff3c`
- **File**: `vercel.json` (modified)
- Added qbo-flush cron entry at `*/5 * * * *` (every 5 minutes)
- vercel.json now has 2 cron entries: generate-pms (daily 6AM UTC) + qbo-flush (every 5 min)

## Build Verification
- `npm run build` passes with 0 errors
- All 7 new/modified routes visible in Next.js route output
- 144 static pages generated successfully

## Requirements Delivered
- **SYNC-03**: Webhook rewrite as thin dispatcher (enqueue only, no API calls)
- **SYNC-04**: Queue flush cron processes 30 jobs per invocation every 5 minutes
- **PAY-03**: Send invoice email via QBO endpoint
- **DASH-01**: Health endpoint with connection status + entity stats
- **DASH-02**: Sync logs with resolution hints
- **DASH-03**: Sync trigger for manual sync (ADMIN only)
- **DASH-05**: Queue stats in health endpoint (pending/claimed/dead_letter/completed)

## Total: 7 commits, 7 files (2 modified, 5 created), ~508 lines of new code
