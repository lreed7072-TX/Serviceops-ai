# External Integrations - ServiceOpsIQ

## Database

### PostgreSQL (Supabase)
- **Provider**: Supabase (managed PostgreSQL)
- **Connection Details**:
  - URL: `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - Pooled Connection: `process.env.DATABASE_URL` (PgBouncer)
  - Direct Connection: `process.env.DIRECT_URL` (for migrations)
- **Schema**: `prisma/schema.prisma` (1700+ lines)
- **Models**: 30+ tables including:
  - Users, Organizations, Roles, Invitations
  - Work Orders, Tasks, Work Packages
  - Assets, Sites, Customers
  - QuickBooks Online connections
  - Customer Portal tokens
  - Form templates and responses
  - Audit logs
  - Materials, Labor Rates, Notifications
- **Key Features**:
  - Row-Level Security (RLS) enabled for multi-tenant isolation
  - All tables include `orgId` for tenant segregation
  - Automatic timestamps: `createdAt`, `updatedAt`
  - Soft deletes via `deletedAt` where applicable
  - Relationships: Foreign keys with cascade/restrict policies

**File Location**: `prisma/schema.prisma`

---

## Authentication Providers

### Supabase Auth (Primary)
- **Service**: OAuth 2.0 authentication with session management
- **Config Files**:
  - Server client: `src/lib/supabase/server.ts`
  - Admin client: `src/lib/supabase/admin.ts`
  - Browser client: `src/lib/supabase/browser.ts`
- **Key Functions**:
  - Session-based auth via cookies (managed by `@supabase/ssr`)
  - Bearer token support for mobile apps (added phase C)
  - `getAuthContextFromSupabase()`: Resolves user → organization mapping
  - `requireAuthSessionFirst()`: Prioritizes session auth, falls back to header auth
- **Usage**:
  - API route: `await getAuthContextFromSupabase(request)`
  - Middleware: Automatic session refresh in `middleware.ts`
  - Context Type**: `AuthContext { orgId, userId, role }`
- **Database Mapping**: `user_org_roles` table (users → organizations + roles)

**File Location**: `src/lib/auth.ts`, `src/lib/supabase/server.ts`

### Custom Dev Auth (Local Only)
- **Purpose**: Fallback auth for local development (no Supabase required)
- **Activation**: `NODE_ENV=development` + `DEV_AUTH_BYPASS=true`
- **Method**: Server-side env vars:
  - `DEV_ORG_ID`, `DEV_USER_ID`, `DEV_ROLE`
  - Or header-based: `x-org-id`, `x-user-id`, `x-role`
- **Security**: Completely disabled in production via startup checks
- **Usage**: Route handlers and middleware fallback path

**File Location**: `src/lib/auth.ts`

### Portal Auth (Customer-Facing)
- **Service**: Token-based authentication for customer portal
- **Token Storage**: `CustomerPortalToken` model in Prisma
- **Token Validation**:
  - Extract from cookie `portal_token` or query param `token`
  - Check active status and expiry
  - Update `lastUsedAt` on each request
- **Context Type**: `PortalContext { orgId, customerId, customerName }`
- **Key Functions**:
  - `requirePortalAuth()`: Validates and returns portal context
  - Token generation (in customer endpoints)
- **Routes Protected**: `/api/portal/*` and `/portal/*` pages

**File Location**: `src/lib/portal-auth.ts`

---

## External APIs

### QuickBooks Online (QBO)

#### OAuth 2.0 Integration
- **Endpoints**:
  - Auth URL: `https://appcenter.intuit.com/connect/oauth2`
  - Token URL: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
  - Sandbox API: `https://sandbox-quickbooks.api.intuit.com/v3/company`
  - Production API: `https://quickbooks.api.intuit.com/v3/company`
- **Environment Control**: `QBO_ENVIRONMENT` env var (`sandbox` | `production`)
- **Client Credentials**:
  - `QBO_CLIENT_ID`: OAuth client ID
  - `QBO_CLIENT_SECRET`: OAuth secret
  - `QBO_REDIRECT_URI`: Callback URL for OAuth code exchange

#### Stored Connection
- **Model**: `QboConnection` in Prisma schema
- **Fields**:
  - `orgId`: Tenant identifier
  - `realmId`: QBO company ID
  - `accessToken`, `refreshToken`: OAuth tokens
  - `accessTokenExpiry`: Token expiration time
  - `isActive`: Boolean flag for active connection
- **Token Refresh**: Automatic 5-minute buffer before expiry
- **Update Strategy**: Tokens stored in DB after each refresh

#### API Functions
**File Location**: `src/lib/qbo/qbo-client.ts`

- `getAuthorizationUrl(orgId, redirectUri)`: Generate OAuth URL
- `exchangeCodeForTokens(code, realmId)`: Exchange auth code → tokens
- `refreshAccessToken(connection)`: Refresh expired tokens
- `getValidAccessToken(connection)`: Get fresh token with auto-refresh
- `createCustomer(connection, customerData)`: Sync customer to QBO
- `updateCustomer(connection, qboCustomerId, customerData)`: Update customer
- `getCustomer(connection, qboCustomerId)`: Fetch customer
- `createInvoice(connection, invoiceData)`: Create invoice in QBO
- `getInvoice(connection, qboInvoiceId)`: Fetch invoice
- `getCompanyInfo(connection)`: Retrieve connected company details
- `verifyWebhookSignature(payload, signature, webhookVerifierToken)`: HMAC-SHA256 signature verification

#### Data Sync
**File Location**: `src/lib/qbo/qbo-sync.ts`

- `getActiveConnection(orgId)`: Find org's QBO connection
- `syncCustomerToQbo(orgId, customerId)`: Sync ServiceOps customer to QBO
- `handleQboPaymentWebhook(payload)`: Process QBO payment events

#### API Endpoints
- **OAuth Callback**: `/api/integrations/qbo/callback` (exchange code for tokens)
- **QBO Webhook**: `/api/integrations/qbo/webhook` (POST/GET)
  - POST: Receives payment events, validates signature
  - GET: QBO setup verification
- **Settings UI**: `/api/integrations/qbo/settings` (connection management)

---

## Webhooks

### QuickBooks Online Webhook
- **Route**: `/api/integrations/qbo/webhook`
- **Method**: POST (events), GET (verification)
- **Signature Verification**: HMAC-SHA256 using `QBO_WEBHOOK_VERIFIER_TOKEN`
- **Processing**:
  - Validates `intuit-signature` header
  - Parses JSON payload
  - Calls `handleQboPaymentWebhook()` to process payment status changes
  - Returns 200 OK on success (QBO retries on non-200)
- **Event Types**: Payment status updates, invoice changes
- **Payload Format**: JSON with QBO event metadata

**File Location**: `src/app/api/integrations/qbo/webhook/route.ts`

---

## Cron Jobs

### PM Schedule Auto-Generation
- **Route**: `/api/cron/generate-pms` (GET endpoint)
- **Schedule**: Daily at 06:00 UTC (`0 6 * * *`)
- **Configuration**: `vercel.json`
- **Security**:
  - Authorization: Bearer token via `CRON_SECRET` env var
  - Request header: `Authorization: Bearer ${CRON_SECRET}`
  - Vercel-specific (uses X-Vercel-Cron-Verified header internally)
- **Functionality**:
  - Queries due PM schedules with `autoGenerateWorkOrders = true`
  - Generates work orders with nested tasks from procedure templates
  - Calculates next scheduled date based on frequency (DAILY/WEEKLY/MONTHLY/YEARLY)
  - Updates `lastGeneratedDate`, `executionCount`, `nextScheduledDate`
  - Returns JSON: `{ success, generated, checked, errors }`
- **Database Interaction**:
  - Reads: `WorkflowDefinition` (schedules), `ProcedureTemplate` (steps)
  - Writes: `WorkOrder`, `WorkPackage`, `TaskInstance`
  - Cascading creates for full WO structure

**File Location**: `src/app/api/cron/generate-pms/route.ts`

---

## Email Service

### Resend
- **Provider**: Resend (email delivery API)
- **API Key**: `RESEND_API_KEY` env var
- **From Address**: `noreply@serviceopsiq.com` (default)
- **From Name**: `ServiceOpsIQ` (customizable per send)

#### Email Functions
**File Location**: `src/lib/email.ts`

- `sendEmail(options)`: Core function
  - Parameters: `to`, `subject`, `html`, `fromName?`, `fromEmail?`, `replyTo?`
  - Async, fire-and-forget pattern
  - Used throughout the app for transactional emails

#### Email Types (Inferred from Code)
- Work order assignments
- Status change notifications
- Quote approvals
- Invoice reminders
- PM schedule due notifications
- User invitations
- Portal access grants

---

## Notifications

### In-App Notification System
- **Storage**: `Notification` model in Prisma schema
- **Display**: React Toast context provider component
- **Location**: `src/lib/notifications.ts`

#### Notification Types
- `WORK_ORDER_ASSIGNED`
- `WORK_ORDER_STATUS_CHANGED`
- `TASK_COMPLETED`
- `COMMENT_ADDED`
- `PM_SCHEDULE_DUE`
- `QUOTE_APPROVED`
- `QUOTE_REJECTED`
- `INVOICE_PAID`

#### Functions
- `createNotification(params)`: Core creation (catches errors silently)
- `notifyWorkOrderAssigned()`: WO assignment notification
- `notifyWorkOrderStatusChanged()`: Status change notification
- `notifyPMScheduleDue()`: PM schedule reminder
- `notifyMultipleUsers()`: Broadcast to multiple users

#### Data Model
- Fields: `userId`, `orgId`, `type`, `title`, `message`, `actionUrl`, `metadata`
- Metadata: JSON string (flexible structure per notification type)
- No automatic cleanup (manual archival expected)

---

## Error Tracking & Monitoring

### Sentry
- **Service**: Error tracking and performance monitoring
- **Configuration**: `next.config.ts` (wrapped with `withSentryConfig`)
- **Organization**: `serviceopsiq`
- **Project**: `serviceopsiq-web`
- **Environment Variables**:
  - `SENTRY_AUTH_TOKEN`: Source map upload auth (build-only)
  - `SENTRY_ORG`, `SENTRY_PROJECT`: Auto-populated in config
- **Features Enabled**:
  - Error capturing (uncaught exceptions, async errors)
  - Performance monitoring (transaction tracking)
  - Source maps for error context
  - Silent mode (no console output)
- **Data Collection**:
  - Route Handlers (server errors)
  - Server Components (server-side errors)
  - Client Components (browser errors)
  - Performance metrics (page load, API response times)

**File Location**: `next.config.ts`

---

## External Content & Assets

### Image Optimization
- **Service**: Vercel Image Optimization (built into Next.js deployment)
- **Format**: Next.js `Image` component (optimizes on-the-fly)
- **Supported**: PNG, JPG, WebP, AVIF
- **CSP Allowance**: `img-src 'self' data: blob: https:`

### CDN & Static Files
- **Service**: Vercel Edge Network (automatic)
- **Static Assets**: Cached via `_next/static/`
- **Fonts**: Self-hosted via `@fontsource/` packages

---

## API Security & Middleware

### Rate Limiting (In-App)
- **Implementation**: `src/lib/rate-limit.ts` (IP-based bucketing)
- **Tiers**:
  - Auth endpoints: 20 requests/min
  - Email endpoints: 10 requests/min
  - AI generation: 10 requests/min
  - Export: 5 requests/min
  - General API: 100 requests/min
- **Enforcement**: Middleware-level in `middleware.ts`
- **Response Headers**:
  - `Retry-After`: Time to wait before retry
  - `X-RateLimit-Limit`: Maximum requests
  - `X-RateLimit-Remaining`: Requests left

### CSRF Protection
- **Method**: Origin validation in middleware
- **Protected Methods**: POST, PUT, PATCH, DELETE
- **Protected Routes**: `/api/*`
- **Logic**: Compares request `Origin` header to `Host` header
- **Exceptions**: Requests without Origin header (mobile apps) are allowed

### Canonical Host Enforcement
- **Production Only**: `VERCEL_ENV=production`
- **Canonical Host**: `serviceops-ai.vercel.app`
- **Response**: 308 redirect for non-canonical hosts
- **Purpose**: Prevent subdomain/alias confusion

---

## Mobile & Offline Support (Related Integrations)

### Supabase Real-Time (Future)
- **Not yet integrated** but architecture prepared
- **Potential Use**: Live work order updates, task status sync
- **Schema**: RLS policies in place for multi-tenant isolation

### Expo Push Notifications (Mobile App)
- **Endpoint**: `/api/tech/push-token` (stores device tokens)
- **Service**: Expo Notifications (expo-notifications SDK)
- **Trigger**: From web backend when work order assigned to mobile user
- **Usage**: Mobile app receives push notification to open assigned WO

---

## Summary of Integration Points

| Integration | Type | Purpose | Status |
|-------------|------|---------|--------|
| Supabase Auth | Identity Provider | User authentication + sessions | Active |
| PostgreSQL (Supabase) | Database | Main relational storage | Active |
| QuickBooks Online | ERP Integration | Customer/Invoice sync | Active |
| Resend | Email Service | Transactional emails | Active |
| Sentry | Error Tracking | Production monitoring | Active |
| Vercel | Deployment | Hosting + Cron + CI/CD | Active |
| Anthropic API | AI | Text generation (optional) | Available |
| Expo Notifications | Push Service | Mobile push (mobile app) | Available |

---

## Environment Variable Checklist

**Required for Deployment**:
- [ ] `DATABASE_URL` - Supabase pooled connection
- [ ] `DIRECT_URL` - Supabase direct connection
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role
- [ ] `RESEND_API_KEY` - Resend email API key
- [ ] `CRON_SECRET` - Vercel Cron bearer token

**Optional (if QBO enabled)**:
- [ ] `QBO_CLIENT_ID` - QuickBooks OAuth client ID
- [ ] `QBO_CLIENT_SECRET` - QuickBooks OAuth secret
- [ ] `QBO_REDIRECT_URI` - OAuth callback URL
- [ ] `QBO_ENVIRONMENT` - `sandbox` or `production`
- [ ] `QBO_WEBHOOK_VERIFIER_TOKEN` - Webhook signature token

**Optional (if Sentry enabled)**:
- [ ] `SENTRY_AUTH_TOKEN` - Sentry source map upload

---

## File Organization Reference

```
src/lib/
├── auth.ts                    # Supabase + dev auth context
├── portal-auth.ts             # Customer portal token auth
├── notifications.ts           # In-app notification system
├── email.ts                   # Resend integration
├── qbo/
│   ├── qbo-client.ts          # QBO API client
│   └── qbo-sync.ts            # QBO data sync
├── supabase/
│   ├── server.ts              # Server-side Supabase client
│   ├── admin.ts               # Admin-level client
│   ├── browser.ts             # Browser client
│   └── client.ts              # Client wrapper
└── rate-limit.ts              # Rate limiting logic

src/app/api/
├── integrations/qbo/
│   ├── callback/route.ts      # OAuth code exchange
│   ├── settings/route.ts      # Connection management
│   └── webhook/route.ts       # QBO event webhooks
├── cron/
│   └── generate-pms/route.ts  # PM schedule auto-gen
└── [... 100+ other routes]

src/
├── middleware.ts              # Auth, CSRF, rate-limit, session refresh
└── lib/supabase/              # Supabase client initialization

prisma/
└── schema.prisma              # Database schema + models
```

