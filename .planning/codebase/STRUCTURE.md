# ServiceOpsIQ Directory Structure & File Organization

## Top-Level Directory Layout

```
Serviceops-ai/                          # Project root
├── .planning/                          # Architecture & planning docs (this dir)
│   └── codebase/                       # Codebase analysis
│       ├── ARCHITECTURE.md             # Architecture patterns & data flow
│       └── STRUCTURE.md                # Directory layout & naming conventions
├── src/                                # Source code root
│   ├── app/                            # Next.js App Router (routing & pages)
│   ├── components/                     # React components
│   ├── contexts/                       # React Context API
│   ├── hooks/                          # Custom React hooks
│   ├── lib/                            # Shared libraries & utilities
│   ├── __tests__/                      # Unit & integration tests
│   └── instrumentation.ts              # Sentry initialization
├── prisma/                             # Database schema & migrations
│   ├── schema.prisma                   # Prisma schema (~1700 lines)
│   └── migrations/                     # Database migration history
├── docs/                               # User-facing & technical documentation
├── public/                             # Static assets
│   ├── manifest.json                   # PWA manifest
│   ├── icon-*.png                      # App icons
│   └── service-worker.js               # Offline support
├── .env                                # Environment variables (local dev)
├── .env.local                          # Local overrides (git-ignored)
├── .env.example                        # Template for .env
├── .env.production.template            # Production env template
├── .gitignore                          # Git exclusions
├── .gitattributes                      # CRLF normalization
├── middleware.ts                       # Next.js middleware (global request handler)
├── next.config.ts                      # Next.js configuration
├── vercel.json                         # Vercel deployment config (cron jobs)
├── package.json                        # Dependencies & scripts
├── package-lock.json                   # Locked dependency versions
├── tsconfig.json                       # TypeScript configuration
├── eslint.config.mjs                   # ESLint rules
├── vitest.config.ts                    # Vitest test runner config
├── next-env.d.ts                       # Next.js TypeScript definitions
├── docker-compose.yml                  # Local PostgreSQL (development)
├── CONTEXT_HANDOFF.md                  # Handoff documentation
├── HANDOFF.md                          # Session handoff notes
├── AGENTS.md                           # Agent instructions
└── ... (other handoff/session docs)
```

## Source Code Structure

### `src/app/` — Next.js App Router

**File-Based Routing:** Files in `src/app/` automatically become routes.

**Directory Patterns:**
- `[param]` — Dynamic segment (id, slug, etc.)
- `(groupName)` — Route group (layout sharing, no URL change)
- `layout.tsx` — Shared layout for route & children
- `page.tsx` — Route's page component
- `error.tsx` — Error boundary for route
- `route.ts` — API route handler (GET, POST, PUT, PATCH, DELETE)

**Route Structure:**

```
src/app/
├── layout.tsx                          # Root layout (PWA, fonts, globals.css)
├── page.tsx                            # / (landing page redirect)
├── favicon.ico                         # Favicon
├── global-error.tsx                    # Global error boundary
├── globals.css                         # Global CSS (~730 lines)
│
├── (auth)/                             # Auth route group (no sidebar)
│   └── login/
│       └── page.tsx                    # /login (Supabase OAuth)
│
├── (tech)/                             # Field technician routes (TECH role)
│   ├── layout.tsx                      # Tech layout (mobile-optimized, no sidebar)
│   └── [routes]/                       # Tech pages
│       ├── dashboard/
│       ├── work-orders/
│       ├── check-in/
│       └── profile/
│
├── (app)/                              # Admin/dispatcher routes (ADMIN, DISPATCHER)
│   ├── layout.tsx                      # Main shell layout (sidebar nav)
│   ├── shell.css                       # Sidebar & layout styles
│   ├── error.tsx                       # Error boundary
│   ├── dashboard/                      # /dashboard (overview)
│   ├── analytics/                      # /analytics (charts & metrics)
│   ├── work-orders/                    # /work-orders (CRUD, list/detail)
│   ├── quotes/                         # /quotes
│   ├── invoices/                       # /invoices
│   ├── visits/                         # /visits (visit execution)
│   ├── customers/                      # /customers (CRM)
│   ├── sites/                          # /sites (locations)
│   ├── assets/                         # /assets (equipment)
│   ├── materials/                      # /materials (inventory)
│   ├── reports/                        # /reports (custom forms)
│   │   ├── templates/                  # Report templates
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Template detail
│   │   │       └── builder/            # Builder page (drag-drop)
│   │   │           ├── page.tsx
│   │   │           └── builder.css
│   │   ├── responses/                  # Form responses
│   │   │   ├── page.tsx                # Response list
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Response detail + PDF
│   │   └── page.tsx                    # Reports overview
│   ├── pm-schedules/                   # /pm-schedules (preventive maintenance)
│   ├── procedure-templates/            # /procedure-templates (knowledge)
│   ├── standards-packs/                # /standards-packs
│   ├── knowledge-base/                 # /knowledge-base
│   ├── help/                           # /help (help center)
│   ├── users/                          # /users (user management, ADMIN)
│   ├── settings/                       # /settings (org config, ADMIN)
│   │   ├── qbo/                        # QuickBooks integration
│   │   ├── audit-logs/                 # Audit log viewer
│   │   └── page.tsx                    # Settings overview
│   └── inventory/                      # /inventory
│
├── portal/                             # Customer portal (token-based auth)
│   ├── layout.tsx                      # Portal layout
│   ├── portal.css                      # Portal styles
│   ├── page.tsx                        # Portal dashboard
│   ├── login/                          # /portal/login (token entry)
│   ├── quotes/
│   │   ├── page.tsx                    # Quote list
│   │   └── [id]/                       # Quote detail
│   ├── invoices/
│   │   ├── page.tsx                    # Invoice list
│   │   └── [id]/                       # Invoice detail
│   └── work-orders/
│       ├── page.tsx                    # WO list
│       └── [id]/                       # WO detail
│
├── api/                                # API routes (backend)
│   ├── auth/
│   │   ├── logout/route.ts
│   │   └── callback/route.ts           # OAuth callback handler
│   │
│   ├── work-orders/
│   │   ├── route.ts                    # GET (list), POST (create)
│   │   └── [id]/
│   │       ├── route.ts                # GET, PUT, DELETE
│   │       ├── tasks/                  # Task management
│   │       │   └── [taskId]/
│   │       │       └── route.ts
│   │       ├── ai-generate/route.ts    # AI task breakdown
│   │       ├── complete/route.ts       # Mark as complete
│   │       └── ... (other operations)
│   │
│   ├── customers/route.ts              # Customer CRUD
│   ├── sites/route.ts                  # Site CRUD
│   ├── assets/route.ts                 # Asset CRUD
│   ├── materials/route.ts              # Material CRUD
│   ├── quotes/route.ts                 # Quote CRUD
│   ├── invoices/route.ts               # Invoice CRUD
│   ├── visits/route.ts                 # Visit CRUD
│   │
│   ├── form-templates/
│   │   ├── route.ts                    # GET, POST
│   │   └── [id]/route.ts               # GET, PUT, DELETE
│   │
│   ├── form-responses/
│   │   ├── route.ts                    # GET, POST
│   │   └── [id]/
│   │       ├── route.ts                # GET, PUT, DELETE
│   │       ├── submit/route.ts         # Submit response
│   │       └── pdf/route.ts            # Generate PDF
│   │
│   ├── portal/                         # Customer portal API
│   │   ├── quotes/[id]/route.ts
│   │   ├── invoices/[id]/route.ts
│   │   └── work-orders/[id]/route.ts
│   │
│   ├── settings/
│   │   ├── integrations/
│   │   │   └── qbo/
│   │   │       ├── oauth/route.ts      # QBO auth start
│   │   │       ├── callback/route.ts   # QBO auth callback
│   │   │       └── sync/route.ts       # Manual sync
│   │   └── test-email/route.ts         # Email test
│   │
│   ├── analytics/
│   │   ├── route.ts                    # Analytics data
│   │   ├── export/route.ts             # CSV export
│   │   └── ...
│   │
│   ├── cron/
│   │   └── generate-pms/route.ts       # Daily PM auto-generation
│   │
│   ├── integrations/
│   │   ├── qbo/...                     # QBO endpoints
│   │   └── webhooks/qbo-payment/       # QBO webhook
│   │
│   ├── search/route.ts                 # Global search
│   ├── notifications/route.ts          # Notification list
│   ├── me/route.ts                     # Current user info
│   ├── users/route.ts                  # User management
│   ├── invites/
│   │   └── accept/route.ts             # Accept org invite
│   │
│   └── ... (40+ other resource endpoints)
│
└── offline/
    └── page.tsx                        # Offline fallback page (PWA)
```

### `src/components/` — React Components

**Organization:** Components organized by feature/domain + shared UI.

```
src/components/
├── ui/                                 # Shared UI primitives (no business logic)
│   ├── Button.tsx                      # Styled button
│   ├── Card.tsx                        # Card container
│   ├── Modal.tsx                       # Modal dialog
│   ├── Toast.tsx                       # Toast notifications (Context + hook)
│   ├── Toast.css                       # Toast styles
│   ├── LoadingSpinner.tsx              # Loading indicator
│   ├── LoadingSkeleton.tsx             # Skeleton loader
│   ├── Breadcrumbs.tsx                 # Breadcrumb nav
│   ├── Breadcrumbs.css
│   ├── PageHeader.tsx                  # Page title + actions
│   ├── StatusBadge.tsx                 # Status indicator
│   ├── ConfirmDialog.tsx               # Confirmation modal
│   ├── EmptyState.tsx                  # Empty state placeholder
│   ├── PullToRefreshHint.tsx           # Mobile refresh hint
│   ├── shared-ui.css                   # Shared UI styles (~15KB)
│   └── index.ts                        # Barrel export
│
├── common/                             # Cross-cutting concerns
│   ├── ErrorBoundary.tsx               # Error boundary wrapper
│   ├── ServiceWorkerRegistration.tsx   # PWA registration
│   └── ...
│
├── auth/                               # Auth-related components
│   ├── LoginForm.tsx
│   ├── LogoutButton.tsx
│   └── ...
│
├── charts/                             # Recharts components
│   ├── WorkOrderChart.tsx
│   ├── RevenueChart.tsx
│   ├── TasksCompletedChart.tsx
│   └── ... (6 chart components)
│
├── search/                             # Global search
│   ├── SearchProvider.tsx              # Global search modal + context
│   ├── SearchTrigger.tsx               # Search icon button
│   ├── SearchResults.tsx
│   └── search.css
│
├── filters/                            # Filter UI components
│   ├── FilterBar.tsx
│   ├── AdvancedFilters.tsx
│   └── ...
│
├── tasks/                              # Task-specific components
│   ├── TaskForm.tsx
│   ├── TaskCard.tsx
│   ├── TaskList.tsx
│   ├── TaskTimeline.tsx
│   └── ...
│
├── settings/                           # Settings feature components
│   ├── QBOSettings.tsx
│   ├── UserSettings.tsx
│   ├── AuditLogViewer.tsx
│   ├── settings.css
│   └── ...
│
├── pm/                                 # Preventive maintenance
│   ├── PMScheduleForm.tsx
│   ├── PMCalendar.tsx
│   ├── PMChart.tsx
│   └── ... (~13 PM components)
│
├── materials/                          # Material/inventory
│   ├── MaterialForm.tsx
│   ├── MaterialPicker.tsx
│   ├── InventoryTable.tsx
│   └── ...
│
├── notifications/                      # Notification UI
│   ├── NotificationBell.tsx            # Bell icon + dropdown
│   ├── NotificationList.tsx
│   └── ...
│
├── knowledge-base/                     # KB feature
│   ├── KBSearch.tsx
│   ├── KBArticle.tsx
│   └── ...
│
├── signatures/                         # Signature components
│   ├── SignaturePad.tsx
│   ├── SignatureCanvas.tsx
│   └── ...
│
├── SidebarNav.tsx                      # Main sidebar navigation
├── TechLayoutClient.tsx                # Tech app layout wrapper
├── PhotoCapture.tsx                    # Photo capture UI (web)
├── PhotoGallery.tsx                    # Photo gallery viewer
├── FreeCameraButton.tsx                # Camera button
├── FreeCameraModal.tsx                 # Camera modal
├── CheckInBanner.tsx                   # GPS check-in status
├── AITaskReviewModal.tsx               # AI task review dialog
├── AttachmentsPanel.tsx                # File attachments UI
└── LogoutButton.tsx                    # Logout button
```

### `src/lib/` — Shared Libraries & Utilities

```
src/lib/
├── auth.ts                             # Authentication context (Supabase + dev)
├── dev-auth.ts                         # Dev-only auth bypass helpers
├── portal-auth.ts                      # Token-based portal auth
│
├── prisma.ts                           # Prisma client singleton
├── api.ts                              # API client utilities
├── api-client.ts                       # Browser API client
├── api-server.ts                       # Server API utilities
│
├── supabase/
│   ├── server.ts                       # Supabase server client
│   ├── browser.ts                      # Supabase browser client
│   ├── client.ts                       # Supabase client selector
│   └── admin.ts                        # Supabase admin client
│
├── email/
│   ├── email.ts                        # Resend email sender
│   ├── templates/
│   │   ├── invite.ts                   # Org invite email
│   │   ├── welcome.ts                  # Welcome email
│   │   └── ... (other email templates)
│   └── utils.ts                        # Email utilities
│
├── qbo/                                # QuickBooks Online integration
│   ├── qbo-client.ts                   # QBO API wrapper
│   ├── qbo-sync.ts                     # Bidirectional sync
│   ├── oauth.ts                        # OAuth flow
│   └── types.ts                        # QBO TypeScript types
│
├── pdf/                                # PDF generation
│   ├── pdf-generator.ts                # PDF generation orchestrator
│   ├── invoice-pdf.ts                  # Invoice PDF (@react-pdf)
│   ├── quote-pdf.ts                    # Quote PDF
│   ├── work-order-pdf.ts               # Work order PDF
│   ├── service-report.ts               # Service report PDF
│   ├── documents/
│   │   ├── FormReportDocument.tsx      # Custom form report renderer
│   │   ├── WorkOrderTemplate.tsx
│   │   └── ... (document templates)
│   └── utils.ts                        # PDF utilities
│
├── forms/                              # Custom form system
│   ├── types.ts                        # Form & block type definitions
│   ├── validation.ts                   # Form field validation
│   ├── calculations.ts                 # Calculated field logic
│   └── index.ts                        # Barrel export
│
├── ai/                                 # AI integration (Claude)
│   ├── task-planner.ts                 # Task breakdown generation
│   ├── analysis.ts                     # Work order analysis
│   └── prompt-templates.ts             # System prompts
│
├── audit.ts                            # Audit logging
├── notifications.ts                    # Push notifications
├── geolocation.ts                      # Geo utilities
├── email.ts                            # Email service
├── export.ts                           # CSV/Excel export
├── rate-limit.ts                       # Rate limiting (in-memory)
├── validation.ts                       # Request validation
├── utils.ts                            # General utilities
└── help-data.ts                        # Help center content (~235KB static)
```

### `src/hooks/` — Custom React Hooks

```
src/hooks/
├── useAdvancedFilters.ts               # Advanced filter state management
└── ... (other custom hooks)
```

### `src/contexts/` — React Context

```
src/contexts/
└── CheckInContext.tsx                  # Geo check-in state (field tech)
```

### `src/__tests__/` — Test Suite

```
src/__tests__/
├── setup.ts                            # Test configuration (Vitest mocks)
├── helpers/
│   ├── test-fixtures.ts                # Mock data generators
│   ├── auth-mocks.ts                   # Auth mocking utilities
│   └── prisma-mocks.ts                 # Prisma client mocks
├── lib/
│   ├── auth.test.ts                    # Auth logic tests
│   ├── rate-limit.test.ts              # Rate limiting tests
│   └── ... (library tests)
└── api/
    ├── work-orders/
    │   ├── route.test.ts               # WO endpoints
    │   └── [id]/route.test.ts          # WO detail endpoints
    ├── quotes/route.test.ts            # Quote endpoints
    └── ... (API route tests)
```

## Configuration Files

### `prisma/schema.prisma`
- Database schema definition (~1700 lines)
- 60+ models covering all domains
- Enums for roles, statuses, types
- Relationships and constraints
- Data validation rules

### `middleware.ts`
- Global request handler
- Rate limiting, CSRF, session refresh
- Canonical host enforcement
- See ARCHITECTURE.md for details

### `next.config.ts`
- Security headers (CSP, X-Frame-Options, etc.)
- Camera permission for `/tech` routes
- Sentry integration

### `vercel.json`
- Cron job configuration
- `/api/cron/generate-pms` at 6 AM UTC daily

### `package.json`
**Key Scripts:**
- `npm run dev` — Start dev server (http://localhost:3000)
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run test` — Run unit tests (Vitest)
- `npm run test:watch` — Watch test mode
- `npm run prisma:migrate` — Create/apply migrations

### `tsconfig.json`
- Strict mode enabled
- Path aliases: `@/` → `src/`
- DOM lib + Next.js types

## Naming Conventions

### Files
- **React Components:** PascalCase, `.tsx` extension (e.g., `WorkOrderForm.tsx`)
- **Utilities:** camelCase, `.ts` extension (e.g., `parseJson.ts`)
- **API Routes:** `route.ts` at each level
- **Styles:** `.css` (custom CSS, no Tailwind)
- **Types/Interfaces:** Exported from `.ts` files, optional `.d.ts` files

### Directories
- **Features:** kebab-case (e.g., `work-orders/`, `pm-schedules/`)
- **Utilities:** kebab-case (e.g., `ui/`, `api/`)
- **Groups:** parentheses for route groups (e.g., `(app)/`, `(auth)/`)

### Database Models
- **Tables:** PascalCase (e.g., `WorkOrder`, `Customer`, `Asset`)
- **Fields:** camelCase (e.g., `workOrderNumber`, `customerId`)
- **IDs:** `id` (primary key, UUID)
- **Foreign Keys:** `{modelName}Id` (e.g., `customerId`, `orgId`)
- **Timestamps:** `createdAt`, `updatedAt`
- **Status Fields:** `status` enum type

### API Endpoints
- **GET:** Fetch resource(s)
- **POST:** Create new resource
- **PUT:** Replace entire resource
- **PATCH:** Update partial resource
- **DELETE:** Remove resource
- **Resource Format:** `/api/{resource}`, `/api/{resource}/[id]`, `/api/{resource}/[id]/{action}`

### Enums (Prisma)
- All caps, snake_case (e.g., `WorkOrderStatus`, `IN_PROGRESS`)
- Used in database queries and type safety

## Route Patterns & URL Structure

### Admin/Dispatcher Routes
```
/dashboard                              # Overview
/analytics                              # Metrics & charts
/work-orders                            # List
/work-orders/[id]                       # Detail
/work-orders/[id]/tasks                 # Task list
/work-orders/[id]/tasks/[taskId]        # Task detail
/quotes                                 # Quote list
/quotes/[id]                            # Quote detail
/invoices                               # Invoice list
/invoices/[id]                          # Invoice detail
/visits                                 # Visit list
/visits/[id]                            # Visit detail
/customers                              # Customer list
/customers/[id]                         # Customer detail
/sites                                  # Site list
/sites/[id]                             # Site detail
/assets                                 # Asset list
/assets/[id]                            # Asset detail
/materials                              # Material list
/materials/[id]                         # Material detail
/reports                                # Reports overview
/reports/templates                      # Template list
/reports/templates/[id]                 # Template detail
/reports/templates/[id]/builder         # Template builder
/reports/responses                      # Response list
/reports/responses/[id]                 # Response detail
/pm-schedules                           # PM schedule list
/pm-schedules/[id]                      # PM detail
/users                                  # User management (ADMIN)
/settings                               # Settings (ADMIN)
/settings/qbo                           # QBO integration
/settings/audit-logs                    # Audit logs
```

### Field Tech Routes
```
/tech                                   # Tech dashboard
/tech/work-orders                       # Assigned WOs
/tech/work-orders/[id]                  # WO detail
/tech/work-orders/[id]/tasks            # Tasks
/tech/work-orders/[id]/tasks/[taskId]   # Task detail (timer, evidence, forms)
/tech/check-in                          # GPS check-in/out
/tech/profile                           # Profile settings
```

### Portal Routes (Token-Based)
```
/portal                                 # Dashboard (quotes, invoices, WOs)
/portal/login                           # Token login
/portal/quotes/[id]                     # Quote detail
/portal/invoices/[id]                   # Invoice detail
/portal/work-orders/[id]                # WO detail
```

### API Routes
```
/api/work-orders                        # GET (list), POST (create)
/api/work-orders/[id]                   # GET, PUT, DELETE
/api/work-orders/[id]/tasks/[taskId]    # PATCH (update task)
/api/quotes                             # GET, POST
/api/customers                          # GET, POST
/api/materials                          # GET, POST
/api/form-templates                     # GET, POST
/api/form-responses                     # GET, POST
/api/form-responses/[id]/submit         # POST (submit response)
/api/form-responses/[id]/pdf            # GET (generate PDF)
/api/settings/integrations/qbo/sync     # POST (manual sync)
/api/cron/generate-pms                  # POST (daily auto-generation)
/api/portal/quotes/[id]                 # GET (customer portal)
```

## Key File Locations

| What | Where |
|------|-------|
| Database schema | `prisma/schema.prisma` |
| Auth logic | `src/lib/auth.ts`, `src/lib/portal-auth.ts` |
| API routes | `src/app/api/**/**/route.ts` |
| Pages | `src/app/**/page.tsx` |
| Components | `src/components/**/*.tsx` |
| Styles | `src/app/globals.css`, `src/components/**/*.css` |
| UI library | `src/components/ui/` |
| Tests | `src/__tests__/**/*.test.ts` |
| PDF generation | `src/lib/pdf/` |
| QBO integration | `src/lib/qbo/` |
| Custom forms | `src/lib/forms/`, `src/components/form/` (mobile) |
| Email templates | `src/lib/email/templates/` |
| Help content | `src/lib/help-data.ts` (~235KB) |
| Middleware | `middleware.ts` |
| Config | `next.config.ts`, `tsconfig.json` |
| Deployment | `vercel.json` |

## Component Organization Examples

### Feature Component Structure
```
work-orders/
├── [id]/
│   ├── page.tsx                        # Detail page (async)
│   ├── WorkOrderDetail.tsx             # Client component
│   ├── TaskList.tsx                    # Child component
│   ├── TaskCard.tsx                    # Child component
│   └── work-order-detail.css           # Local styles
└── page.tsx                            # List page (async)
```

### Shared Component Pattern
```
ui/
├── Button.tsx                          # Presentational
├── Modal.tsx                           # Presentational
├── Toast.tsx                           # Stateful (Context)
└── shared-ui.css                       # Shared styles
```

## CSS Organization

**No Tailwind CSS** — Custom CSS with design tokens.

```css
/* src/app/globals.css — Global tokens & reset */
:root {
  --primary: #1f2937;
  --accent: #f97316;
  --bg-primary: #ffffff;
  --border-color: #e5e7eb;
  /* ... other tokens ... */
}

/* Per-component CSS */
src/components/Button.tsx + Button.css
src/app/(app)/work-orders + work-orders.css
src/app/(tech)/layout.tsx + tech-layout.css
```

**Key CSS Files:**
- `src/app/globals.css` (~730 lines) — Global reset, tokens, base styles
- `src/app/(app)/shell.css` (~360 lines) — Sidebar layout
- `src/components/ui/shared-ui.css` (~15KB) — Shared UI component styles
- `src/components/search/search.css` — Search modal
- `src/app/portal/portal.css` (~15KB) — Portal-specific styles
- Per-route CSS files (e.g., `src/app/(app)/work-orders/work-orders.css`)

## Static Assets

**Public Directory (`public/`):**
- `favicon.ico` — App icon
- `manifest.json` — PWA manifest (app metadata)
- `icon-*.png` — App icons for homescreen
- `service-worker.js` — Offline support

**Fonts:**
- Imported via `@fontsource/space-grotesk` (heading font)
- Imported via `@fontsource/jetbrains-mono` (monospace font)

## Environment Variables

**Development (`.env`, `.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
DATABASE_URL=postgres://...
DIRECT_URL=...
DEV_AUTH_BYPASS=true
DEV_ORG_ID=...
DEV_USER_ID=...
DEV_ROLE=ADMIN
```

**Production (Vercel):**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
DATABASE_URL=postgres://...
DIRECT_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
ANTHROPIC_API_KEY=...
SENTRY_AUTH_TOKEN=...
CRON_SECRET=...
```

## Testing Structure

**Setup:** `src/__tests__/setup.ts`
- Mocks auth, Prisma, Supabase globally
- Default test auth context provided

**Test Files:**
- Located next to source files in `src/__tests__/` mirror
- Pattern: `feature.test.ts` (Vitest)
- Example: `src/__tests__/api/work-orders/route.test.ts`

**Running Tests:**
```bash
npm test                  # Run all tests once
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## Summary

ServiceOpsIQ follows **clear, modular organization:**
- **Routing:** Next.js App Router with route groups
- **Components:** Feature-based directories with local styles
- **API:** Conventional REST endpoints, organized by resource
- **Database:** Prisma ORM with TypeScript models
- **Auth:** Supabase + dev fallback, multi-tenant via orgId
- **Styles:** Custom CSS with design tokens (no Tailwind)
- **Testing:** Vitest with mocked auth/Prisma
- **Deployment:** Vercel with PostgreSQL backend
