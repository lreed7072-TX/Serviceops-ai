# Plan 05-01 Summary: Schema Migration + QBO Client Functions + Mapper Functions

**Status:** Complete
**Commit:** `df8224e`
**Wave:** 1

## What Was Built

### Prisma Schema Migration
- VendorType enum (SUPPLIER, SUBCONTRACTOR, OTHER)
- Vendor model (21 fields, 3 indexes, Org + Material relations)
- QboClassMap model (unique on [orgId, orderType])
- User.qboEmployeeId field
- Material.vendorId FK + Vendor relation
- StockMovement.qboBillId + qboPurchaseId
- QboConnection.classTrackingEnabled + locationTrackingEnabled + preferencesLastCheckedAt
- Invoice.qboCreditMemoId
- Org back-references: vendors[], qboClassMaps[]

### QBO Client Functions (16 new)
Employee CRUD (3), Vendor CRUD (3), TimeActivity (2), Bill (2), Purchase (1), CreditMemo (2), Preferences (1), Class (2)

### Mapper Functions (6 new pure functions)
toQboEmployee, toQboVendor, toQboTimeActivity, toQboBill, toQboPurchase, toQboCreditMemo

## Key Files
- prisma/schema.prisma — Vendor model, QboClassMap, 6 field additions
- src/lib/qbo/qbo-client.ts — 16 new exports
- src/lib/qbo/qbo-mapper.ts — 6 new pure functions
