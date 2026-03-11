# Plan 05-03 Summary: ClassRef Retrofit + Preferences + API Routes + UI

**Status:** Complete
**Commit:** `3304d63`
**Wave:** 3

## What Was Built

### ClassRef Retrofit
- syncInvoiceToQbo now resolves ClassRef from workOrder.orderType
- syncQuoteToQbo includes ClassRef from convertedToOrderType
- createInvoice in qbo-client.ts accepts optional classRef parameter

### CDC Preferences Wiring
- fetchAndCachePreferences called in CDC cron with 23h stale cache check
- Non-fatal — CDC poll continues on preferences fetch failure

### Vendor CRUD API
- GET /api/vendors — paginated list with search
- POST /api/vendors — create with auto-link materials by manufacturer name + QBO enqueue
- GET /api/vendors/[id] — single vendor with materials
- PATCH /api/vendors/[id] — partial update + QBO enqueue
- DELETE /api/vendors/[id] — soft delete

### Credit Memo Endpoint
- POST /api/invoices/[id]/credit — ADMIN/DISPATCHER role gate, validates QBO sync, enqueues creditMemo:push

### Sync-Trigger Extension
- "vendors" and "employees" entity types added

### Health API Extension
- classTrackingEnabled and locationTrackingEnabled in response

### UI Updates
- QBO Health: yellow warning banner when class tracking disabled
- Invoice detail: Issue Credit button with ConfirmDialog (orange accent)

## Key Files
- src/lib/qbo/qbo-sync.ts — ClassRef in syncInvoiceToQbo/syncQuoteToQbo
- src/app/api/cron/qbo-cdc/route.ts — preferences wiring
- src/app/api/vendors/route.ts — new
- src/app/api/vendors/[id]/route.ts — new
- src/app/api/invoices/[id]/credit/route.ts — new
- src/app/(app)/settings/integrations/qbo-health/page.tsx — warning banner
- src/app/(app)/invoices/[id]/page.tsx — Issue Credit button
