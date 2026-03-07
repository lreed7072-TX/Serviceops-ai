# Stack Research: QBO Full Integration

_Generated: 2026-03-07 | Codebase: Next.js 16.1 / Prisma 6.16 / Supabase / Vercel_

---

## Recommended Stack

| Layer | Recommendation | Version |
|---|---|---|
| HTTP Client | Raw `fetch` (keep existing) | Node 20 built-in |
| OAuth Token Mgmt | `intuit-oauth` (add) | ^3.0.0 |
| QBO API Client | Extend existing `qbo-client.ts` | — |
| API minorversion | `75` (mandatory) | — |
| Batch Operations | Native QBO Batch API via `qbo-client.ts` | — |
| CDC Polling | Vercel Cron + Prisma timestamp tracking | — |
| Sync Queue | In-DB queue via `QboSyncQueue` Prisma model | — |
| Retry Logic | Custom exponential backoff utility in `qbo-client.ts` | — |
| Rate Limiting | Token bucket pattern in `qbo-client.ts` | — |

---

## Libraries & SDKs

### 1. Raw `fetch` — KEEP (Confidence: High)

**Current approach**: `qbo-client.ts` uses native `fetch` with manual token refresh, HMAC webhook verification, and typed response wrappers. This is the right call.

**Why keep it**:
- The existing `qboRequest()` wrapper already handles auth headers, sandbox/production URL switching, and error surfacing cleanly.
- Adding 19 new entity types (Estimates, Items, Vendors, Bills, TimeActivity, etc.) is purely additive — the same `qboRequest()` function handles all of them.
- Zero external dependencies means zero supply-chain risk and zero abstraction overhead.
- `node-quickbooks` (see "What NOT to Use") would replace code that already works and is typed.

**What to add to `qbo-client.ts`**:
- `qboBatchRequest()` for multi-operation payloads (up to 30 ops per call)
- `qboQuery()` for SQL-like `SELECT` queries (CDC, Chart of Accounts reads, etc.)
- `qboWithRetry()` wrapper applying exponential backoff (see Infrastructure section)

---

### 2. `intuit-oauth` npm package — ADD for Token Management (Confidence: Medium-High)

**Package**: `intuit-oauth` v3.x — Intuit's own officially maintained OAuth 2.0 library.
**Weekly downloads**: ~130,000. **GitHub stars**: 134. Last updated: active.

**Why add it**:
- The current `refreshAccessToken()` implementation is correct for basic use. However, as the integration deepens to 19 sync points, token lifecycle edge cases multiply: what happens when a cron job fires during token expiry? What about concurrent webhook + cron refresh collisions?
- `intuit-oauth` handles PKCE, state validation, OpenID Connect discovery, and token revocation — all things you will encounter when submitting for Intuit's production app review.
- The package validates the ID token signature on token exchange, which raw `fetch` cannot do without crypto boilerplate.

**Why NOT mandatory right now**: The existing custom refresh logic works. Only add `intuit-oauth` if you hit production OAuth submission requirements or token collision bugs first.

**Installation**:
```bash
npm install intuit-oauth
```

**Usage pattern** (token refresh layer only — keep your existing DB persistence logic):
```typescript
import OAuthClient from 'intuit-oauth';

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID!,
  clientSecret: process.env.QBO_CLIENT_SECRET!,
  environment: process.env.QBO_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  redirectUri: process.env.QBO_REDIRECT_URI!,
});
```

---

### 3. No additional npm packages needed (Confidence: High)

The following were evaluated and rejected:

- `node-quickbooks` — see "What NOT to Use"
- `quickbooks-sdk` — too new, incomplete entity coverage, unclear maintenance commitment
- `p-retry` or `async-retry` — unnecessary when a 15-line custom backoff is sufficient and avoids a dependency
- `bottleneck` — appropriate for persistent servers, not serverless where each invocation is stateless

---

## Infrastructure Patterns

### CDC (Change Data Capture) — Vercel Cron (Confidence: High)

**Recommendation**: Vercel Cron polling every 15 minutes. Do NOT use an external service.

**Rationale**:
- QBO CDC endpoint: `GET /cdc?entities=Invoice,Payment,Customer,Item&changedSince=<ISO8601>`
- CDC returns all changed objects for multiple entity types in a single request — one API call covers all 19 sync points for a given org.
- CDC tracks changes within the last 30 days maximum. A 15-minute polling interval is well within limits and aligns with the Intuit 2025 guidance to prefer webhooks but use CDC for guaranteed consistency.
- Vercel Cron runs inside the same serverless environment as your API routes — no additional infrastructure, no additional cost tier, consistent with existing PM cron pattern.
- Vercel function timeout: 60s max on Pro plan. A CDC poll + DB write for one org easily fits in 10-15 seconds.

**Pattern**:
```
/api/cron/qbo-cdc-sync   →  every 15 min  →  for each active QboConnection:
  1. GET /cdc?changedSince=connection.lastSyncAt
  2. Upsert changed entities to Prisma models
  3. Update connection.lastSyncAt = now()
  4. Write QboSyncLog entries
```

**Dual-path sync**: Webhooks handle real-time events (payment received, invoice voided); CDC poll handles anything the webhook missed (delayed delivery, out-of-order events, network drops). This is the correct production pattern — webhooks for latency, CDC for correctness.

**Add to `vercel.json`**:
```json
{ "path": "/api/cron/qbo-cdc-sync", "schedule": "*/15 * * * *" }
```

---

### In-DB Sync Queue — Prisma Model (Confidence: High)

**Recommendation**: Add a `QboSyncQueue` table to Prisma schema. Do NOT use BullMQ or any Redis-based queue.

**Why in-DB, not BullMQ**:
- BullMQ requires a persistent Redis instance. Vercel serverless functions are stateless — a worker process cannot hold a queue connection open between invocations. You would need a separate long-running worker (Railway, Fly.io, etc.), which adds infrastructure complexity and cost that is not justified at this integration scale (19 sync points, one company per org at a time).
- An in-DB queue via Prisma is a proven pattern for this traffic level: fewer than ~10,000 sync events per day per org is well within PostgreSQL's capability.
- You already have `QboSyncLog` — the queue is the companion: pending items waiting to be processed, log records what happened.

**Proposed schema addition**:
```prisma
model QboSyncQueue {
  id          String   @id @default(uuid()) @db.Uuid
  orgId       String   @db.Uuid
  entityType  String   // "invoice", "customer", "item", "vendor", etc.
  entityId    String   @db.Uuid
  operation   String   // "push", "pull", "void", "email"
  status      String   @default("pending") // "pending", "processing", "done", "failed"
  attempts    Int      @default(0)
  lastError   String?  @db.Text
  scheduledAt DateTime @default(now())
  processedAt DateTime?
  createdAt   DateTime @default(now())

  @@index([orgId, status, scheduledAt])
  @@index([status, attempts])
}
```

**Queue processor**: The existing PM cron pattern applies here too. A cron at `*/5 * * * *` pulls `status=pending` rows ordered by `scheduledAt`, processes up to 20 per run (respecting QBO rate limits), and marks done or increments `attempts` on failure. Items with `attempts >= 3` move to `failed` and surface in the integration dashboard.

---

### Retry / Exponential Backoff (Confidence: High)

**Recommendation**: Implement a `withRetry()` utility directly in `qbo-client.ts`. No external library.

**Pattern**:
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  opts = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 10_000 }
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const isRateLimit = err instanceof Error && err.message.includes('429');
      const isServerError = err instanceof Error && /5\d\d/.test(err.message);
      if (attempt >= opts.maxAttempts || (!isRateLimit && !isServerError)) throw err;
      const jitter = Math.random() * 200;
      const delay = Math.min(opts.baseDelayMs * 2 ** (attempt - 1) + jitter, opts.maxDelayMs);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}
```

**Key rules**:
- Only retry HTTP 429 (rate limit) and 5xx (server errors). Never retry 400/401/404 — those are data problems, not transient.
- Parse `Retry-After` header on 429 responses and use that value as the delay when present — QBO includes it.
- Maximum 3 retries per operation within a single function invocation (serverless timeout constraint).
- Failed-after-retries items go into the `QboSyncQueue` with `status=failed` for the cron processor to handle.

---

### Rate Limiting Against QBO (Confidence: High)

**QBO limits**:
- 500 requests/minute per realm (company)
- 10 concurrent requests per app (across all realms)
- Batch endpoint: 30 operations per batch call, ~40 batch calls/minute

**Approach for serverless**:

Stateless serverless functions cannot share an in-memory token bucket. Instead:

1. **Use batch API aggressively**: Anytime you sync multiple entities of the same type (initial bulk sync, or syncing all materials for a WO), pack up to 30 operations into a single `POST /batch` call. This reduces API call count by up to 30x.
2. **Sequential, not parallel**: In sync cron jobs, process org connections one at a time (not `Promise.all` across all orgs). This keeps concurrent request count predictable.
3. **Queue-based rate control**: The `QboSyncQueue` cron processor naturally rate-controls by processing a fixed batch per invocation (20 items every 5 minutes = well under 500/min).
4. **Respect 429 with backoff**: The `withRetry()` above handles burst violations at the individual request level.

---

### QBO API minorversion to Target (Confidence: High)

**Recommendation**: Use `minorversion=75` on all API calls immediately.

**Why 75 specifically**:
- Intuit announced in January 2025 that minor versions 1–74 are deprecated. As of August 1, 2025, API calls without a minorversion >=75 may be automatically migrated or rejected.
- minorversion 75 is the stable baseline that guarantees access to all features needed for the 19 integration points: full `TimeActivity` entity, `Class` and `Location` tracking on transactions, `Estimate` workflow, `Bill` and `Vendor` full field sets.
- There is no meaningful benefit to targeting a higher version than 75 unless a specific field you need was added in 76+. Start at 75, only bump if a specific feature requires it.

**Implementation**: Add `minorversion=75` as a default query parameter in `qboRequest()`:
```typescript
const url = `${getApiBase()}/${connection.realmId}/${path}?minorversion=75`;
```

If `path` already contains query params (e.g., a CDC call), append with `&minorversion=75` instead.

---

## What NOT to Use

### `node-quickbooks` npm package (Confidence: High — avoid)

**Reason**: The package wraps the QBO REST API in callback-style methods with implicit typing. It was written for QBO v1 era and while it receives maintenance updates, it introduces two serious problems for this codebase:

1. **TypeScript incompatibility**: The package has no first-class TypeScript types. Every return value is `any`. In a strict-mode TypeScript codebase (this project has strict enabled), you immediately lose type safety on all QBO data shapes — exactly the kind of data that feeds into financial records.
2. **Redundant abstraction**: Your `qbo-client.ts` already implements a clean, typed wrapper over the same REST endpoints. Replacing it with `node-quickbooks` would mean rewriting working, typed code to use an untyped third-party wrapper, then patching back the type definitions manually.
3. **Serverless incompatibility**: `node-quickbooks` stores OAuth tokens in memory by default, which is incompatible with stateless serverless functions. You have already solved this correctly by persisting tokens in Prisma.

**Exception**: If Intuit ever ships an official TypeScript SDK with full type coverage and serverless-safe token management, re-evaluate.

---

### BullMQ / Redis queue (Confidence: High — avoid for now)

**Reason**: BullMQ requires a persistent Redis connection and a long-running worker process. Vercel serverless cannot host either. Adding Redis (Upstash or similar) and a separate worker host (Railway/Fly) for a feature that Prisma-based queue handles adequately at this scale is over-engineering.

**Reconsider if**: Monthly sync event volume exceeds 500,000 across all orgs, or if a single org's sync load exceeds Postgres write capacity (extremely unlikely for a field service company).

---

### Intuit's `intuit-developer-nodejs` sample repo as a base (Confidence: High — avoid)

**Reason**: The official Intuit sample repo is a demonstration project, not a production library. It uses Express (not Next.js), stores tokens in session memory (not a database), and has no multi-tenancy. It is useful only for reading OAuth flow examples.

---

### Polling individual entities on a timer (Confidence: High — avoid)

**Reason**: Individually polling `/invoice/{id}`, `/customer/{id}` etc. on a schedule is O(n) API calls per entity. CDC is O(1) per sync cycle regardless of how many entities changed. For 19 entity types, CDC reduces polling cost by up to 19x and is the pattern Intuit explicitly recommends in their 2025 best practices documentation.

---

### `minorversion` values below 75 (Confidence: High — avoid)

**Reason**: Deprecated as of August 1, 2025 per Intuit's January 2025 announcement. Do not use unversioned calls or any version 1–74.

---

## Confidence Notes

| Recommendation | Confidence | Notes |
|---|---|---|
| Keep raw `fetch`, extend `qbo-client.ts` | High | Existing code is correct; additive pattern scales to all 19 entities |
| `minorversion=75` | High | Intuit's official deprecation notice is explicit; no ambiguity |
| Vercel Cron for CDC polling | High | Consistent with existing cron pattern; fits in 60s timeout easily |
| In-DB queue via Prisma | High | Validated pattern for this traffic scale; avoids Redis infrastructure |
| Exponential backoff with 429 + 5xx retry | High | Standard; Intuit's own best practices documentation confirms this |
| Do NOT use `node-quickbooks` | High | TypeScript incompatibility alone is disqualifying in strict mode |
| Do NOT use BullMQ | High | Architectural mismatch with Vercel serverless |
| Add `intuit-oauth` for token management | Medium-High | Optional unless production app review requires it or token collision bugs appear |
| Batch endpoint for bulk sync | High | Intuit documents 30 ops/batch; reduces API calls by up to 30x |
| CDC as primary inbound sync mechanism | High | Intuit's own 2025 guidance explicitly recommends CDC over individual polling |

**What needs validation before implementation**:
1. Confirm `minorversion=75` field availability for `TimeActivity`, `Class`, `Location` entities in sandbox before writing sync code for those entities.
2. Verify that the `QBO_ENVIRONMENT=production` app on Intuit's developer portal has the `com.intuit.quickbooks.accounting` scope approved — some CorePlus endpoints (Employee, Time Tracking) require a separate scope approval.
3. Test CDC response envelope shape for all 19 entity types in sandbox — the CDC response wraps entities differently than individual GET responses, and `qboQuery()` will need entity-specific unwrapping.
4. Confirm Vercel Pro plan cron frequency limit — free plan supports daily only; 15-minute CDC polling requires Pro (already on Pro per deployment setup).

---

_Sources consulted: Intuit Developer Docs (CDC, minor versions, batch, rate limits), npm trends (intuit-oauth vs node-quickbooks), Intuit January 2025 API deprecation notice, Intuit August 2025 optimization blog, Satva Solutions QBO rate limit guide._
