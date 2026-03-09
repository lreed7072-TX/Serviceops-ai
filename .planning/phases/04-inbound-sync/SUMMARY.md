---
plan: "04-01"
title: "QboInvoice type fix + inbound sync functions"
status: complete
date: "2026-03-09"
commits: 5
---

# Plan 04-01 Execution Summary

## What Was Done

5 tasks executed atomically (one commit each) delivering the type fix and
all four inbound sync functions for Phase 4.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 4a8c8ef | 04-01-01 | Add `status?: string` to QboInvoice type for void detection |
| 1aa290c | 04-01-02 | `processInboundCustomer()` — SYNC-02 customer inbound sync |
| 80c752b | 04-01-03 | `processCdcCustomerPull()` wrapper + getCustomer/voidInvoice imports |
| 4d492df | 04-01-04 | `processCdcInvoiceChange()` — PAY-02 inbound void/payment detection |
| 21d6c7b | 04-01-05 | `processVoidInvoiceInQbo()` — PAY-02 outbound cancel via void API |

## Files Modified

- `src/lib/qbo/qbo-types.ts` — added `status?: string` after `Balance` on QboInvoice
- `src/lib/qbo/qbo-sync.ts` — added `getCustomer` + `voidInvoice` imports, `fromQboCustomer` import, 4 new exported functions

## Functions Added (all exported from `@/lib/qbo/qbo-sync`)

### processInboundCustomer(orgId, qboCustomer, connectionId)
Handles SYNC-02 customer inbound sync with field-ownership split.
- Lookup: qboCustomerId match first, email fallback for unlinked records
- Update path: applies QBO-wins fields (name, email, phone, billing address)
- Create path: creates new customer record, omits createdByUserId (nullable)
- Active:false from QBO is logged only — ServiceOps wins on status

### processCdcCustomerPull(orgId, qboCustomerId, realmId)
Thin wrapper for the cron flush dispatcher. Fetches QBO customer by ID then
delegates to processInboundCustomer(). Uses same connection lookup pattern
as processPaymentJob (orgId + realmId + isActive).

### processCdcInvoiceChange(orgId, qboInvoiceId, realmId)
PAY-02 inbound change detection. Priority order:
1. Void: `status === "Voided"` → CANCELED (no-op if already CANCELED)
2. Full payment: `Balance === 0` → PAID with paidAt (no-op if already PAID)
3. Partial payment: `0 < Balance < TotalAmt` → log only, no status change
4. No change: returns success silently

### processVoidInvoiceInQbo(orgId, invoiceId)
PAY-02 outbound cancel. Fetches fresh SyncToken on every call (not stored).
Guards against double-void (qboInvoice.status === "Voided" → skip API call).
Queue retry handles stale SyncToken races.

## Decisions Made

- `voidInvoice` and `getCustomer` both added to qbo-client import in same commit (task 03) since both were needed for tasks 03 and 05
- Used string literals "CANCELED"/"PAID" (not InvoiceStatus enum import) per plan guidance — matches Prisma enum values without an unnecessary import
- `processCdcInvoiceChange` handles missing ServiceOps invoice gracefully: logs and returns success (QBO-only invoice, not an error)
- `processVoidInvoiceInQbo` logs success (not error) when already voided in QBO, consistent with idempotent operation semantics

## Verification

- `npx tsc --noEmit` — 0 errors in QBO files; pre-existing test errors in __tests__/ are unrelated
- `npx next build` — clean build, all pages compiled
- 4 new functions confirmed exported at lines 881, 973, 1021, 1163 of qbo-sync.ts
