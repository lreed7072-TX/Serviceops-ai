# Plan 03-02 Summary: Sync Functions — Item, Customer Retrofit, Quote, Invoice, Payment

## Status: COMPLETE

## Commits (6)
1. `f91dbc3` — 03-02-01 Implement syncMaterialToQbo sync function
2. `fea9c05` — 03-02-02 Implement syncLaborRateToQbo sync function
3. `8df42fa` — 03-02-03 Retrofit syncCustomerToQbo with DisplayName collision handling
4. `6437788` — 03-02-04 Implement syncQuoteToQbo sync function
5. `e77dea7` — 03-02-05 Modify syncInvoiceToQbo for ItemRef resolution and LinkedTxn
6. `5b3c33d` — 03-02-06 Implement processPaymentJob for payment receipt processing

## Files Modified
- `src/lib/qbo/qbo-sync.ts` — 6 new/modified sync functions (~390 lines added)
- `src/lib/qbo/qbo-client.ts` — Extended `createInvoice()` with `itemRef` per line + `linkedTxn` param

## What Was Built

### syncMaterialToQbo (Task 01)
- Creates/updates QBO NonInventory Item from Material record
- Uses `resolveOrCreateQboEntity` for collision-safe creation
- Stores `qboItemId` on Material after first sync
- Account mapping gated (requires `materials_income`)

### syncLaborRateToQbo (Task 02)
- Creates/updates QBO Service Item from LaborRate record
- Uses `resolveOrCreateQboEntity` for collision-safe creation
- Stores `qboItemId` on LaborRate after first sync
- Account mapping gated (requires `labor_income`)

### syncCustomerToQbo Retrofit (Task 03)
- Replaced direct `createCustomer()` call on create path with `resolveOrCreateQboEntity`
- Matches on email for existing QBO customers with same DisplayName
- Falls back to "(SvcOps)" suffix when collision occurs but no email match

### syncQuoteToQbo (Task 04)
- Pushes Quote as QBO Estimate with status guard (SENT or APPROVED only)
- Cascade-syncs customer and materials before estimate creation
- Adds `ItemRef` on estimate lines for synced materials
- Stores `qboEstimateId` and `qboSyncedAt` on Quote record

### syncInvoiceToQbo Rewrite (Task 05)
- Includes `materialUsage → material` chain in invoice query
- Includes `quote` relation for LinkedTxn resolution
- Cascade-syncs materials via materialUsage chain before invoice creation
- Resolves `ItemRef` per line item from `materialUsage.material.qboItemId`
- Adds `LinkedTxn` from estimate when invoice.quote has `qboEstimateId`
- Modified `createInvoice()` in qbo-client.ts to accept `itemRef` per line and `linkedTxn`

### processPaymentJob (Task 06)
- Fetches QBO Payment by ID, extracts linked invoice IDs from payment lines
- For each linked QBO invoice that matches a ServiceOps invoice:
  - If `Balance === 0`: marks invoice as PAID with `paidAt` timestamp
  - If `Balance > 0`: logs partial payment without status change
- Comprehensive logging with payment amount, method, date, and balance

## Requirements Delivered
- ITEM-01: Material → QBO NonInventory Item sync
- ITEM-02: LaborRate → QBO Service Item sync + ItemRef on invoice lines
- VEND-02: DisplayName collision handling on customer create path
- QUOT-01: Quote → QBO Estimate sync with status guard
- QUOT-02: Estimate ItemRef on lines with synced materials
- PAY-01: Payment processing with full/partial payment handling

## Verification
- Build passes: `npm run build` — 0 TypeScript errors
- All 6 sync functions exported from qbo-sync.ts
- Cascade sync chains verified: invoice → customer, invoice → materials, invoice → quote → estimate
