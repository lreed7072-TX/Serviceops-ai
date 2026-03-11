# ServiceOpsIQ — QBO Full Integration

## What This Is

A comprehensive QuickBooks Online integration for ServiceOpsIQ that connects the entire service management lifecycle — quotes, invoices, payments, time tracking, materials, expenses, purchase orders — with QBO's accounting system. Every financial transaction flows automatically with bidirectional sync, dimensional tracking, and proactive monitoring.

## Core Value

Every financial transaction in ServiceOpsIQ must flow to QBO automatically and accurately, so the business owner never double-enters data and their books are always current.

## Current State (v1.0 shipped 2026-03-10)

**Stack:** Next.js 16.1, React 19, TypeScript 5, Prisma 6.16, Supabase, Vercel
**QBO Module:** 5 core files in `src/lib/qbo/` — client (12 entity types), sync (18 functions), types (35+ exports), mapper (12 pure transforms), queue (7 functions)
**Tests:** 250 total (163 QBO-specific across 18 test files)
**Cron:** 4 Vercel cron jobs (PM generation, queue flush, CDC polling, token monitoring)

## Requirements

### Validated

- ✓ OAuth 2.0 connect/disconnect flow — pre-existing
- ✓ Customer outbound sync — pre-existing, retrofitted with collision handling (v1.0)
- ✓ Invoice outbound push — pre-existing, rewritten with ItemRef + LinkedTxn (v1.0)
- ✓ FOUND-01–09: Foundation fixes + infrastructure — v1.0
- ✓ FOUND-10: Client extensions (batch, CDC, void, email) — v1.0
- ✓ ACCT-01–03: Chart of Accounts mapping + prerequisite gate — v1.0
- ✓ PAY-01–03: Payment processing + bidirectional status sync + invoice email — v1.0
- ✓ QUOT-01–03: Estimate sync + LinkedTxn conversion + credit memo — v1.0
- ✓ ITEM-01–02: Item/service sync + ItemRef on invoice lines — v1.0
- ✓ VEND-01–02: Vendor sync + DisplayName collision handling — v1.0
- ✓ PO-01: Purchase order sync with three-way matching — v1.0
- ✓ TIME-01–02: Employee + time activity sync — v1.0
- ✓ EXP-01: Expense/bill sync — v1.0
- ✓ DIM-01–04: Class + location tracking + preferences check + PM auto-invoice — v1.0
- ✓ SYNC-01–04: CDC polling + inbound customer sync + webhook rewrite + idempotency — v1.0
- ✓ RPT-01–02: QBO Reports API + date range/filter support — v1.0
- ✓ DASH-01–05: Health dashboard + error logs + manual triggers + token monitoring + queue flush — v1.0

### Active

(None — next milestone requirements TBD via `/gsd:new-milestone`)

### Out of Scope

- Bank deposit matching — QBO handles natively with ML matching; requires Plaid + PCI compliance
- Multi-currency support — US-market only; touches every financial entity
- QBO Payroll integration — regulated compliance domain; Employee + Time Activity sync feeds QBO Payroll
- QBO Payments processing — requires PCI-DSS scope; portal payment links route to QBO's native flow
- QuickBooks Desktop sync — Intuit sunsetting Desktop; target market runs QBO Online/Advanced
- QBO recurring transaction templates — no REST API; implemented as cron + standard invoice push

## Context

Shipped v1.0 with 27,228 lines of QBO integration code across 114 files.
Tech stack: Next.js 16.1 API routes (serverless), Prisma 6.16, Supabase PostgreSQL, Vercel.
QBO API: REST v3, minorversion=75, 500 req/min rate limit, batch operations for bulk sync.
Multi-tenant: every sync operation scoped to orgId, QBO connection per-org.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CAS flag for token refresh mutex | PgBouncer blocks SELECT FOR UPDATE | ✓ Good — zero race conditions |
| Fetch-Merge-POST for sparse updates | Prevents data corruption on partial payloads | ✓ Good — no field erasure |
| Prisma-based durable queue | Simpler than external queue, works in serverless | ✓ Good — reliable with stale lock detection |
| Pure mapper functions (no I/O) | Testable, predictable transformations | ✓ Good — 12 mappers, all unit tested |
| Thin webhook dispatcher | Returns 200 in <50ms, defers to queue | ✓ Good — no QBO timeouts |
| CDC polling (4h) over real-time | Compatible with Vercel serverless limits | ✓ Good — cursor-based, multi-org isolation |
| NonInventory items (no QBO inventory) | Service company doesn't track inventory | ✓ Good — correct entity type |
| Account mapping prerequisite gate | Prevents revenue posting to Uncategorized Income | ✓ Good — clear error UX |
| No DB caching for Chart of Accounts | Always fresh from QBO, simplifies invalidation | ✓ Good — reliable |
| DepartmentRef mirrors ClassRef pattern | Consistent resolver pattern (auto-create, null when disabled) | ✓ Good — clean architecture |

## Constraints

- **Serverless:** All QBO operations must complete within Vercel function limits (10s default, 60s max)
- **QBO Rate Limits:** 500 requests/min per realm, 10 concurrent — batch operations where possible
- **QBO Webhooks:** Can be delayed and arrive out-of-order — sync logic must be idempotent
- **SyncToken:** Every QBO entity update requires current SyncToken — fetch before update
- **Multi-tenancy:** Every sync operation scoped to orgId; QBO connection is per-org
- **Token Expiry:** QBO refresh tokens expire after 100 days — proactive monitoring required

---
*Last updated: 2026-03-10 after v1.0 milestone*
