---
status: complete
phase: 02-client-extensions-account-mapping
source: 01-SUMMARY.md, 02-SUMMARY.md, 03-SUMMARY.md, 04-SUMMARY.md
started: 2026-03-09T15:26:00Z
updated: 2026-03-09T15:27:00Z
---

## Current Test

[testing complete]

## Tests

### 1. QBO Client Extension Methods Exported (FOUND-10)
expected: qbo-client.ts exports 5 new functions — batchRequest, queryEntities, cdcRequest, voidInvoice, sendInvoiceEmail
result: pass

### 2. Batch Request Validates Max 30 Operations
expected: batchRequest() throws when operations array exceeds 30 items and returns empty array for 0 items
result: pass

### 3. Query Entities URL-Encodes IQL
expected: queryEntities() URL-encodes the IQL string and extracts the entity array from the response
result: pass

### 4. CDC Request Formats Correctly
expected: cdcRequest() joins entity names with commas and formats changedSince as ISO string
result: pass

### 5. Void Invoice Uses operation=void
expected: voidInvoice() POSTs to invoice?operation=void with Id and SyncToken only (not sparse update)
result: pass

### 6. Send Invoice Email Uses Correct Content-Type
expected: sendInvoiceEmail() POSTs with Content-Type application/octet-stream and supports optional sendTo param
result: pass

### 7. Accounts API Route Exists (ACCT-01)
expected: GET /api/integrations/qbo/accounts route exists with auth guard, fetches live QBO Chart of Accounts via queryEntities()
result: pass

### 8. Account Mapping CRUD API (ACCT-02)
expected: GET /api/integrations/qbo/account-mapping returns mappings by category; PUT upserts a single category (ADMIN only, validates 5 categories)
result: pass

### 9. Account Mapping Prerequisite Gate (ACCT-03)
expected: requireAccountMapping() returns { complete, missing } for 5 categories; syncInvoiceToQbo() blocks with descriptive error when mapping incomplete
result: pass

### 10. Gate Blocks Before Any QBO API Call
expected: When account mapping is incomplete, syncInvoiceToQbo() returns error BEFORE making any QBO API call — no invoice created in QBO
result: pass

### 11. Multi-Tenant Isolation on Account Mapping
expected: requireAccountMapping() and getAccountMapping() only query the specified orgId — no cross-tenant data leakage
result: pass

### 12. Account Mapping UI Section (ACCT-02)
expected: Integrations settings page shows "Chart of Accounts Mapping" section with 5 category dropdowns (Labor Income, Materials Income, Service Fee Income, Job Cost Expense, Subcontractor Expense)
result: pass

### 13. Warning Banner for Incomplete Mapping
expected: Yellow warning banner appears at top of connected section when account mapping is incomplete
result: pass

### 14. Unit Tests Pass — 17 New Tests
expected: All 17 Phase 2 QBO tests pass (10 client extension + 7 account mapping gate), 0 failures
result: pass

### 15. Build Clean
expected: `next build` completes with no errors from Phase 2 files
result: pass

## Summary

total: 15
passed: 15
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
