# ServiceOpsIQ — QBO Full Integration

## What This Is

A comprehensive QuickBooks Online integration milestone for ServiceOpsIQ, expanding the existing basic OAuth + customer/invoice sync into 19 additional integration points. This connects ServiceOpsIQ's entire service management lifecycle — quotes, invoices, payments, time tracking, materials, expenses — with QBO's accounting system, making ServiceOpsIQ the single source of truth for field operations while QBO handles the books.

## Core Value

Every financial transaction in ServiceOpsIQ must flow to QBO automatically and accurately, so the business owner never double-enters data and their books are always current.

## Requirements

### Validated

- OAuth 2.0 connect/disconnect flow — existing
- Customer outbound sync (ServiceOps → QBO) — existing
- Invoice outbound push (ServiceOps → QBO) — existing
- Basic payment webhook listener — existing (logs events, incomplete processing)
- QBO connection settings UI — existing

### Active

- [ ] Payment receipt processing (complete the webhook → mark PAID flow)
- [ ] Invoice status bidirectional sync (void, partial payment, balance)
- [ ] Invoice email via QBO API
- [ ] Estimate sync (quotes → QBO Estimates)
- [ ] Credit memo creation
- [ ] Chart of Accounts pull for account mapping
- [ ] Item/Service sync (materials + labor rates ↔ QBO Items)
- [ ] Vendor sync
- [ ] Purchase order sync
- [ ] Time activity sync (time entries → QBO TimeActivity)
- [ ] Employee sync (techs → QBO employees)
- [ ] Expense/Bill sync (job expenses → QBO Bills/Purchases)
- [ ] Class tracking on synced transactions
- [ ] Location/Department tracking on synced transactions
- [ ] Recurring invoice templates for maintenance contracts
- [ ] Change Data Capture inbound sync
- [ ] QBO Reports API integration (P&L, A/R Aging, Balance Sheet)
- [ ] Customer inbound sync (QBO → ServiceOps)
- [ ] Enhanced integration dashboard (health, mapping, logs, manual triggers)

### Out of Scope

- Bank deposit matching — high complexity, low ROI for v1; QBO handles this natively
- Multi-currency support — ServiceOpsIQ targets US-based service companies; adds significant complexity to every sync point
- QBO Payroll integration — payroll is a separate domain with compliance requirements
- QBO Payments API (payment processing) — customers pay through QBO directly, not through ServiceOps

## Context

- **Existing codebase**: `src/lib/qbo/qbo-client.ts` (393 lines, core API client) and `qbo-sync.ts` (293 lines, customer + invoice sync + webhook handler)
- **QBO connection model**: `QboConnection` in Prisma schema stores OAuth tokens, realmId, sync timestamps
- **Sync logging**: `QboSyncLog` model already tracks all sync operations with entity type, action, status
- **QBO API version**: Using REST API v3 with minorversion parameter; sandbox + production support
- **Token management**: Auto-refresh with 5-minute buffer already implemented
- **Webhook**: Signature verification with HMAC-SHA256 already working; event processing is skeletal (logs only)
- **Current gaps**: No batch operations, no CDC polling, no inbound sync, no account mapping, webhook doesn't actually update invoice status

## Constraints

- **Tech Stack**: Next.js 16.1 API routes (serverless), Prisma 6.16, Supabase PostgreSQL — all QBO operations must work within serverless function limits (10s default, 60s max on Vercel)
- **QBO API Rate Limits**: 500 requests/min per realm, 10 concurrent — must implement exponential backoff and batch operations where possible
- **QBO Webhook Latency**: Webhooks can be delayed several minutes and arrive out of order — sync logic must be idempotent
- **SyncToken Requirement**: Every QBO entity update requires the current SyncToken (optimistic concurrency) — must fetch before update
- **Multi-tenancy**: Every sync operation scoped to orgId; QBO connection is per-org
- **QBO Intuit Partner Program**: API access tiers may limit some CorePlus endpoints; verify available entities before implementation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Exclude bank deposit matching | High complexity, QBO handles natively, low user value | — Pending |
| Exclude multi-currency | US-market focus, adds complexity to every sync point | — Pending |
| Use CDC for inbound sync vs. polling individual entities | CDC is more efficient, single API call for all changes since timestamp | — Pending |
| Batch operations for bulk sync | QBO supports up to 30 ops per batch request, reduces API calls | — Pending |
| Account mapping UI before transaction sync | Users need to map ServiceOps categories to QBO accounts before sync makes sense | — Pending |

---
*Last updated: 2026-03-07 after initialization*
