# ServiceOpsIQ Architecture

## Overview

ServiceOpsIQ is an **enterprise multi-tenant SaaS platform** for rotating equipment service management. The architecture follows a **monolithic serverless deployment** pattern built on Next.js with a clear separation between authentication, API routes, and client UI.

- **Architecture Pattern:** Monolithic Full-Stack (Monolith SaaS)
- **Deployment:** Serverless (Vercel) with PostgreSQL + Supabase
- **Stack:** Next.js 16.1, React 19, TypeScript 5, Prisma 6.16, Supabase, Vercel
- **Production URL:** https://serviceops-ai.vercel.app

## Application Layers

### 1. Presentation Layer (Client-Side)
**Location:** `src/app/`, `src/components/`, `src/contexts/`, `src/hooks/`

Responsibility: Render UI, manage client state, and interact with API layer.

- **Three main routes:**
  - `(app)` — Authenticated admin/dispatcher dashboard (role-gated to ADMIN, DISPATCHER)
  - `(tech)` — Field technician app (role-gated to TECH role)
  - `portal` — Customer-facing portal (token-based auth, public URL)
- **Page Components:** Server-side rendered (SSR) with `getAuthContextFromSupabase()` for auth gating
- **Client Components:** React hooks, Supabase client, local state with Context API
- **UI Components:** Custom CSS-based design system (not Tailwind); located in `src/components/ui/`
- **Design Tokens:** Custom CSS variables (primary `#1f2937`, accent `#f97316`, fonts: Space Grotesk + JetBrains Mono)

### 2. Routing & Middleware Layer
**Location:** `middleware.ts`, `src/app/` (Next.js App Router), `src/app/api/`

Responsibility: HTTP request handling, security checks, session management.

**Middleware (`middleware.ts`)** runs on every request:
- **Canonical host enforcement** (production only)
- **CSRF validation** for mutating API requests (POST/PUT/PATCH/DELETE)
- **Rate limiting** tiered by endpoint (e.g., 10/min for AI generation, 100/min for general API)
- **Supabase session refresh** (cookie-based session persistence)

**Next.js App Router** provides file-based routing:
- Dynamic routes with `[id]` parameters
- Route groups with parentheses `(app)`, `(auth)`, `(tech)` for layout sharing
- Automatic code splitting and preloading

**API Routes (`src/app/api/`):**
- 140+ REST endpoints for CRUD operations
- Organized by resource: `work-orders/`, `customers/`, `materials/`, etc.
- Route handlers (`route.ts`) implement GET, POST, PUT, PATCH, DELETE

### 3. Authentication & Authorization Layer
**Location:** `src/lib/auth.ts`, `src/lib/portal-auth.ts`, `src/lib/dev-auth.ts`

Responsibility: User identity verification, session management, role-based access control.

**Primary Auth Strategy: Supabase Session (OAuth 2.0)**
- `getAuthContextFromSupabase(request?)` — Resolves auth from:
  1. Supabase session cookie (browser)
  2. Bearer token from Authorization header (mobile apps)
- Queries `user_org_roles` table to get `orgId`, `userId`, `role`
- Returns `AuthContext = { orgId, userId, role }`

**Auth Context Types:**
```typescript
export type AuthContext = {
  orgId: string;      // Organization UUID
  userId: string;     // Supabase auth.user.id
  role: Role;         // ADMIN | DISPATCHER | TECH
};
```

**Role Mapping:**
- **ADMIN** — Full system access; sees admin settings, user management, audit logs
- **DISPATCHER** — Can create/edit work orders, manage schedules, view analytics
- **TECH** — Field technician; can only view assigned work orders and tasks
- See `src/app/(app)/layout.tsx` for role-gated nav links

**Token-Based Portal Auth (`portal-auth.ts`):**
- Customer portal uses stateless token-based auth (no cookies)
- Customers receive a signed token linked to their organization
- Validates token and resolves to customer org context

**Dev-Only Fallback Auth (`dev-auth.ts`, `auth.ts`):**
- Header-based auth: `x-org-id`, `x-user-id`, `x-role` headers
- Environment-based auth: `DEV_AUTH_BYPASS=true`, `DEV_ORG_ID`, `DEV_USER_ID`, `DEV_ROLE`
- **Restricted:** Only active when `NODE_ENV=development` AND `DEV_AUTH_BYPASS=true`
- Never reads `NEXT_PUBLIC_` vars (avoids client-side secret leaks)
- Fails hard in production/Vercel if any dev vars are set

**Security Constraints:**
- All API routes call `requireAuthSessionFirst(request)` to check auth
- All mutations require role check: `requireRole(auth, [Role.ADMIN, ...])`
- Multi-tenant isolation: all queries include `orgId: auth.orgId` filter

### 4. Business Logic & Data Access Layer
**Location:** `src/lib/`, `prisma/schema.prisma`

Responsibility: Domain models, database queries, business calculations.

**Prisma ORM (`prisma/schema.prisma`, ~1700 lines):**
- PostgreSQL datasource with connection pooling via PgBouncer
- 60+ models covering:
  - **Organizations:** Org, User (Supabase-synced), UserOrgRole (mapping table)
  - **Customers & Sites:** Customer, Site, Asset (with criticality/category/family hierarchy)
  - **Work Management:** WorkOrder, WorkPackage, Task, Visit, FormResponse
  - **Operations:** Material, Inventory, LabourRate, PMSchedule
  - **Quotes & Invoicing:** Quote, QuoteLineItem, Invoice (QBO-synced)
  - **Reports & Forms:** ReportTemplate, FormResponse, TaskFinding, Photo
  - **System:** AuditLog, Invite, Notification, HelpTopic

**Enums (Row-Level Security & Validation):**
- Roles: `ADMIN`, `DISPATCHER`, `TECH`
- Work statuses: `WorkOrderStatus` (OPEN, IN_PROGRESS, COMPLETED, CANCELED)
- Tasks: `TaskStatus` (TODO, IN_PROGRESS, DONE, BLOCKED, SKIPPED)
- Reports: `ReportBlockType` (13 field types including TEXT_INPUT, PHOTO_CAPTURE, SIGNATURE, CALCULATED)
- Asset hierarchy: `AssetCategory`, `AssetFamily`, `AssetSubFamily`, `AssetCriticality`

**Database Access Pattern:**
```typescript
// All queries MUST include orgId filter
const records = await prisma.model.findMany({
  where: { orgId: auth.orgId, ...otherFilters },
  include: { relations... },
});
```

**Key Data Models:**
- **WorkOrder** (central entity) → WorkPackage → Task → Evidence (Photos, Findings, Measurements)
- **Quote** → QuoteLineItem → Invoice (QBO sync) → Payment webhook
- **ReportTemplate** (builder) → FormResponse (submitted form data, stored as JSON in `data` field)
- **Asset** (equipment) → PM Schedule → auto-generated WorkOrders (daily Cron)

### 5. Integration Layer
**Location:** `src/lib/qbo/`, `src/lib/email/`, `src/lib/ai/`, `src/lib/supabase/`

Responsibility: Third-party service integration.

**QuickBooks Online (QBO) Integration (`src/lib/qbo/`):**
- OAuth 2.0 flow to connect customer QBO accounts
- `qbo-client.ts` — API wrapper for QBO v2 API
- `qbo-sync.ts` — Bidirectional sync of customers, invoices, payments
- Settings UI at `src/app/(app)/settings/qbo`

**Email Service (`src/lib/email/`):**
- Resend provider for transactional emails
- HTML email templates with variable interpolation
- Auto-escaping to prevent XSS
- Rate-limited: 10/min via middleware

**AI Task Planning (`src/lib/ai/`):**
- Anthropic Claude SDK for work order AI analysis
- Auto-generates task breakdowns and estimates
- Rate-limited: 10/min via middleware

**Supabase (`src/lib/supabase/`):**
- Server client (`server.ts`) — Auth + DB operations
- Browser client (`browser.ts`) — Real-time subscriptions (future)
- Admin client (`admin.ts`) — Privileged operations (user provisioning)

### 6. PDF Generation Layer
**Location:** `src/lib/pdf/`, `src/lib/pdf/documents/`

Responsibility: Server-side document rendering.

- Uses **@react-pdf/renderer** for component-based PDF generation
- **Document Types:**
  - `invoice-pdf.ts` — Invoice PDF with QBO integration
  - `quote-pdf.ts` — Quote PDF
  - `work-order-pdf.ts` — Work order report
  - `service-report.ts` — Field service report
  - `FormReportDocument.tsx` — Custom form reports (13 field types rendered)
- Generates on-demand and served as `application/pdf` response

### 7. State Management (Client-Side)
**Location:** `src/contexts/`, `src/hooks/`

Responsibility: Client-side ephemeral state.

**Context API:**
- `CheckInContext.tsx` — Geo-location check-in state for techs
- `ToastProvider` — Notifications UI state

**Custom Hooks (Data Fetching):**
- `useAdvancedFilters.ts` — Filter UI state management
- Form hooks (mobile app): `useMaterials`, `useFindings`, `useMeasurements`

**Note:** No global state management library (Redux, Zustand) in the web app. Mobile app (sibling repo) uses Zustand.

## Data Flow: Request to Response

### Example: Create Work Order

1. **User Action** (Frontend `src/app/(app)/work-orders/`)
   - User fills form, clicks "Create"
   - POST to `/api/work-orders` with payload

2. **Middleware** (`middleware.ts`)
   - Rate limit check (100/min tier)
   - CSRF validation (origin check)
   - Supabase session refresh

3. **Route Handler** (`src/app/api/work-orders/route.ts`)
   - Call `requireAuthSessionFirst(request)` to get `AuthContext`
   - Call `requireRole(auth, [ADMIN, DISPATCHER])` for authorization
   - Parse & validate request body
   - Query related entities: Customer, Site, Asset (all filtered by `orgId`)

4. **Prisma ORM**
   - Generate unique work order number per org/type (WO00001, SO00001, etc.)
   - Retry loop if conflict on unique constraint
   - Create WorkOrder record with `orgId: auth.orgId`
   - Create default WorkPackage children (UNIFIED or MULTI_LANE)

5. **Response** (JSON)
   ```json
   {
     "data": {
       "id": "...",
       "workOrderNumber": "WO00001",
       "status": "OPEN",
       "customerId": "...",
       "orgId": "..."
     }
   }
   ```

6. **Frontend** (`src/app/(app)/work-orders/`)
   - React fetches response, updates local state
   - Navigates to detail page `/work-orders/[id]`

### Example: Field Tech Submits Task

1. **Mobile App** (field technician)
   - Fills task form, captures photos, signature
   - POSTs to `/api/work-orders/[id]/tasks/[taskId]` with Bearer token

2. **Auth** (middleware + route handler)
   - Extracts Bearer token from Authorization header
   - Queries Supabase with token → gets `userId`
   - Queries `user_org_roles` → gets `orgId`, role=TECH

3. **Authorization**
   - Checks if task.workOrder.orgId === auth.orgId (multi-tenant isolation)
   - Checks if task.assignedToId === auth.userId (TECH can only update own tasks)

4. **Task Update**
   - Upsert Task record (status→DONE, completedAt→now)
   - Create TaskEvidence records (photos, signature)
   - Trigger PM auto-generation if all tasks DONE (Cron job)

5. **Response**
   - Return updated Task with evidence array

## Multi-Tenancy Architecture

**Isolation Strategy: Organizational Filtering**

Every table includes `orgId` field (UUID):
```prisma
model WorkOrder {
  id      String @id @default(uuid()) @db.Uuid
  orgId   String @db.Uuid  // ← ALWAYS present
  ...
}
```

**Enforcement Points:**
1. **Middleware:** Session refresh resolves orgId from `user_org_roles`
2. **API Routes:** All queries filter by `where: { orgId: auth.orgId, ... }`
3. **Database:** RLS policies (future: not yet enabled, but structure supports it)
4. **Client:** Pages redirect if no auth → prevents data leakage

**Multi-Tenant Data Model:**
- **Org** (root tenant)
  - Users (many-to-many via UserOrgRole)
  - Customers, Sites, Assets, WorkOrders, Quotes, etc. (all belong to Org)
- **UserOrgRole** (junction table: user ↔ org + role)
  - `userId` (Supabase auth.users.id)
  - `orgId` (Org.id)
  - `role` (ADMIN | DISPATCHER | TECH)

**Example Query:**
```typescript
// Get all work orders for user's org
const workOrders = await prisma.workOrder.findMany({
  where: { orgId: auth.orgId },  // ← Org isolation
});
```

## Entry Points

### Web Application

**Public Routes:**
- `/` — Landing page (redirects to login)
- `/login` — Supabase OAuth login page
- `/auth/callback` — OAuth callback handler
- `/invite/:token` — Accept org invite

**Admin/Dispatcher Routes (`(app)` group):**
- `/dashboard` — Analytics overview
- `/analytics` — Detailed charts & metrics
- `/work-orders` — WO list/detail/create
- `/quotes` — Quote management
- `/invoices` — Invoice list
- `/visits` — Visit execution tracking
- `/customers`, `/sites`, `/assets` — Asset inventory
- `/materials` — Material inventory management
- `/reports` — Custom form responses & reports
- `/pm-schedules` — Preventive maintenance scheduler
- `/users` — User management (ADMIN only)
- `/settings` — Organization settings, QBO integration (ADMIN only)

**Field Tech Routes (`(tech)` group):**
- `/tech` — Tech dashboard (assigned WOs)
- `/tech/work-orders` — List of assigned WOs
- `/tech/work-orders/[id]` — Detail with tasks, photos, signature
- `/tech/check-in` — GPS check-in/out

**Customer Portal Routes (`portal` group):**
- `/portal` — Customer dashboard (quotes, invoices, WOs)
- `/portal/quotes/[id]` — View quote
- `/portal/invoices/[id]` — View invoice
- `/portal/work-orders/[id]` — View WO status

### API Routes

**Organization Management:**
- `GET /api/organization` — Get org info
- `GET /api/organization/stats` — Key metrics

**Work Order Operations:**
- `GET /api/work-orders?orderType=WORK_ORDER&limit=50&offset=0` — List
- `POST /api/work-orders` — Create
- `GET /api/work-orders/[id]` — Detail
- `PUT /api/work-orders/[id]` — Update
- `DELETE /api/work-orders/[id]` — Delete
- `POST /api/work-orders/[id]/ai-generate` — AI task breakdown
- `PATCH /api/work-orders/[id]/tasks/[taskId]` — Update task

**Customers & Sites:**
- `GET /api/customers` — List
- `POST /api/customers` — Create
- `GET /api/sites` — List by customer
- `GET /api/assets` — List by site

**Quotes & Invoicing:**
- `GET/POST /api/quotes` — Quote CRUD
- `GET/POST /api/invoices` — Invoice CRUD
- `POST /api/settings/integrations/qbo/sync` — Manual QBO sync

**Custom Forms & Reports:**
- `GET /api/form-templates` — List templates
- `POST /api/form-templates` — Create/publish template
- `POST /api/form-responses` — Submit form response
- `GET /api/form-responses` — List responses

**Cron Jobs:**
- `POST /api/cron/generate-pms` — Auto-generate PMs (6 AM UTC daily)

**Authentication:**
- `POST /api/auth/logout` — Revoke session
- `POST /api/invites/accept` — Accept org invite

## Security & Hardening

**Security Headers** (`next.config.ts`):
- `X-Frame-Options: DENY` — Prevent clickjacking
- `X-Content-Type-Options: nosniff` — Prevent MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `CSP: default-src 'self'` — Restrict resource loading
- `Permissions-Policy: camera=(), microphone=()` — Disable sensors (except `/tech` routes)

**Rate Limiting** (`middleware.ts`):
- Auth endpoints: 20/min
- AI generation: 10/min
- Email: 10/min
- General API: 100/min
- Tracked by client IP per bucket

**CSRF Protection** (`middleware.ts`):
- Validate Origin header matches Host for mutating requests
- Mobile apps bypass (no Origin header expected)

**Auth Security:**
- Supabase session tokens are httpOnly, Secure cookies
- Bearer tokens for mobile apps (Expo)
- Dev auth forbidden in production (fail-fast check)
- Header auth only allowed in local development

**Data Security:**
- Passwords: Managed by Supabase Auth (bcrypt)
- Multi-tenant isolation: orgId filters on every query
- RLS-ready (not yet enabled, but schema supports it)
- Audit logs: All mutations logged to AuditLog table

**Error Handling:**
- Global error boundary in `(app)/layout.tsx`
- Sentry integration for error tracking & performance monitoring
- 404/500 error pages with user guidance

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 18+ | Serverless backend |
| Framework | Next.js 16.1 | Full-stack React framework |
| UI Framework | React 19 | Component-based UI |
| Language | TypeScript 5 | Type-safe code |
| Database | PostgreSQL | Relational data store |
| ORM | Prisma 6.16 | Type-safe DB access |
| Auth | Supabase Auth | OAuth 2.0 + session mgmt |
| PDF | @react-pdf/renderer | Server-side PDF generation |
| Charts | Recharts 3.7 | Data visualization |
| Email | Resend 6.9 | Transactional email |
| AI | Anthropic Claude SDK | Task planning & analysis |
| Icons | Lucide React | SVG icons |
| CSS | Custom CSS + CSS Variables | Design tokens, no Tailwind |
| Testing | Vitest 4.0 | Unit & integration tests |
| Monitoring | Sentry | Error & performance tracking |
| Deployment | Vercel | Serverless hosting |

## Deployment & Scaling

**Hosting:** Vercel (Next.js optimized)
- Auto-scaling serverless functions
- Edge Functions for middleware
- CDN for static assets

**Database:** Supabase PostgreSQL
- PgBouncer connection pooling
- Automatic backups & replication
- Point-in-time recovery

**Environment:** Production
- Canonical domain: `serviceops-ai.vercel.app`
- Build: `npm run build` → `prisma generate && next build`
- Deploy: Git push to main → Vercel CI/CD

**Cron Jobs:** Vercel Cron (via `vercel.json`)
```json
{
  "crons": [
    { "path": "/api/cron/generate-pms", "schedule": "0 6 * * *" }
  ]
}
```
- Runs daily at 6 AM UTC
- Auto-generates preventive maintenance work orders
- Secured with `CRON_SECRET` env var

## Monitoring & Observability

**Error Tracking:** Sentry
- Captures exceptions in Next.js
- Performance monitoring (transaction tracing)
- Release tracking

**Audit Logging:**
- `AuditLog` table records all mutations
- Fields: `userId`, `action`, `resourceType`, `resourceId`, `changes`, `timestamp`
- Queryable via `/settings/audit-logs` (ADMIN only)

**Structured Logging:**
- Console logs (development)
- Sentry breadcrumbs (production)
- No centralized log aggregation yet (future enhancement)
