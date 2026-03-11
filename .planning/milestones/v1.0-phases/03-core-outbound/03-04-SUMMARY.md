# Plan 03-04 Summary: UI — Send via QBO button, integration health dashboard page, sidebar + settings links

## Execution Date
2026-03-09

## Tasks Completed

### 03-04-01: Add Send via QBO button to invoice detail page
- **Commit**: `975afeb`
- **File modified**: `src/app/(app)/invoices/[id]/page.tsx`
- Added `qboInvoiceId: string | null` to the Invoice type
- Added `sendingQbo` state and `sendViaQbo()` handler that calls `/api/integrations/qbo/send-invoice-email`
- Added conditional "Send via QBO" button (orange accent, `btn-primary`) that only renders when `invoice.qboInvoiceId` is truthy
- Toast feedback on success/error

### 03-04-02: Create QBO health dashboard page
- **Commit**: `c121f56`
- **File created**: `src/app/(app)/settings/integrations/qbo-health/page.tsx`
- Full client component (~320 lines) with:
  - **Breadcrumbs**: Settings > Integrations > QBO Health
  - **Connection Status Card**: Company name, realm ID, connected date, token expiry countdown, last sync time, green/red status indicator
  - **Queue Stats Bar**: 4 stat cards (Pending, Processing, Failed, Completed)
  - **Dead Letter Warning**: Amber card when deadLetter > 0
  - **Sync Overview Grid**: 5 entity cards (Customer, Invoice, Item, Estimate, Payment) with success/failed counts, last sync relative time, and manual Sync Now buttons
  - **Error Log Table**: Paginated table with entity filter dropdown, error messages, resolution hints, and retry buttons
- Fetches from 3 API endpoints: `/api/integrations/qbo/health`, `/api/integrations/qbo/sync-logs`, `/api/integrations/qbo/sync-trigger`
- Uses `apiFetch`, `useToast`, `LoadingSpinner`, 11 Lucide icons

### 03-04-03: Create QBO health dashboard CSS
- **Commit**: `92da187`
- **File created**: `src/app/(app)/settings/integrations/qbo-health/qbo-health.css`
- ~514 lines of custom CSS using project design system variables
- Connection status card with green/red left border
- Queue stats bar with color-coded counts
- Sync overview grid with `grid-template-columns: repeat(auto-fill, minmax(250px, 1fr))`
- Error log table with resolution hint boxes (light blue background)
- Dead letter amber warning card
- Spin animation for RefreshCw icon during sync
- Responsive breakpoints at 768px and 480px

### 03-04-04: Add QBO Health link to integrations page
- **Commit**: `4612d26`
- **File modified**: `src/app/(app)/settings/integrations/page.tsx`
- Added `Link` from `next/link` and `Activity` icon from `lucide-react`
- Added "View Sync Health" link (orange outline style) in the integration actions section when QBO is connected
- Links to `/settings/integrations/qbo-health`

### 03-04-05: Add QBO Health link to sidebar navigation
- **Commit**: `2fff22f`
- **Files modified**: `src/components/SidebarNav.tsx`, `src/app/(app)/layout.tsx`
- Added `Activity` import and entry to `iconMap` in SidebarNav
- Added "QBO Health" NavLink entry in the Admin section of sidebar (ADMIN role only), after Settings link

## Build Verification
- `npm run build`: Passed with 0 errors
- New route `/settings/integrations/qbo-health` confirmed in build output

## Requirements Delivered
- **PAY-03**: Send invoice via QBO email (UI button)
- **DASH-01**: Connection status dashboard
- **DASH-02**: Entity sync overview with manual trigger
- **DASH-03**: Error log with resolution hints

## Files Changed (6 total)
1. `src/app/(app)/invoices/[id]/page.tsx` — modified
2. `src/app/(app)/settings/integrations/qbo-health/page.tsx` — created
3. `src/app/(app)/settings/integrations/qbo-health/qbo-health.css` — created
4. `src/app/(app)/settings/integrations/page.tsx` — modified
5. `src/components/SidebarNav.tsx` — modified
6. `src/app/(app)/layout.tsx` — modified
