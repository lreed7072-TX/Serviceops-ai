# Technology Stack - ServiceOpsIQ

## Language & Runtime

- **Node.js Runtime**: v20+ (via Vercel)
- **Language**: TypeScript 5.x
  - Configuration: `tsconfig.json` with strict mode enabled
  - Target: ES2017 (ES8 features)
  - Module system: ESNext (transpiled by Next.js)
- **JavaScript Standard**: ES2017+ with modern async/await, Promises, etc.

## Framework & Core Libraries

### Next.js 16.1
- **Purpose**: Full-stack React framework with built-in API routes, server components, and SSR
- **App Router**: File-based routing in `src/app/`
- **Build**: Vercel deployment with automatic compilation and optimization
- **Key Features Used**:
  - Server Components and Async Components
  - Route Handlers (API routes under `src/app/api/`)
  - Middleware for cross-cutting concerns (auth, rate-limiting, CSRF, session refresh)
  - Dynamic routes with `[id]` patterns
  - TypeScript support out-of-box

### React 19.2.3
- **Purpose**: UI library for component-based frontend
- **Features**:
  - Functional components with hooks
  - React Context for state management (custom hooks)
  - Server Components (via Next.js)
- **No Class Components**: Project exclusively uses React hooks

### React DOM 19.2.3
- **Purpose**: DOM rendering layer for React
- **Rendering**: Client-side rendering + server-side rendering via Next.js

## Build Tools & Bundlers

- **Next.js Bundler**: Webpack (managed by Next.js)
  - Automatic code-splitting for route bundles
  - CSS optimization and bundling
  - Image optimization via Next.js Image component
- **Development Server**: `next dev` (hot module reloading)
- **Production Build**: `next build && next start`
- **TypeScript Compilation**: Integrated via Next.js TypeScript plugin

## Testing & Quality Assurance

- **Vitest 4.0.18**: Unit and integration testing framework
  - Configuration: Default Vitest config (no visible config file)
  - Test files: `src/**/*.test.ts` and `src/**/*.test.tsx` patterns
  - Coverage tracking with `--coverage` flag
  - 55 passing tests at latest session
- **Testing Library**:
  - `@testing-library/react` 16.3.2: Component testing utilities
  - `@testing-library/jest-dom` 6.9.1: DOM matchers
  - `jsdom` 28.1.0: Simulated DOM environment for Node.js
- **ESLint 9.x**:
  - `eslint-config-next`: Next.js-specific linting rules
  - Rule enforcement on commits (pre-commit hooks)
  - Prettier auto-formatting on file save

## Database & ORM

- **PostgreSQL**: Primary relational database
  - Hosted on Supabase (managed PostgreSQL)
  - Connection pooling via PgBouncer (DIRECT_URL for migrations, DATABASE_URL for pooled connections)
- **Prisma 6.16.0**: Type-safe ORM
  - Configuration: `prisma/schema.prisma` (~1700 lines)
  - Client Generation: `@prisma/client` 6.16.0
  - Auto-generates TypeScript types from schema
  - Migrations: Vercel Postgres + `prisma migrate deploy` in CI/CD
  - Raw SQL queries supported via `prisma.$queryRawUnsafe()`
  - Multi-tenant setup: All tables include `orgId` field for tenant isolation

## Frontend UI & Styling

### CSS Variables & Custom Styling
- **Design System**: Custom CSS variables (not Tailwind)
  - Primary color: `#1f2937` (dark slate)
  - Accent color: `#f97316` (orange)
  - Typography: Space Grotesk (headers) + JetBrains Mono (code)
- **Fonts**:
  - `@fontsource/space-grotesk` 5.2.10: Header typography
  - `@fontsource/jetbrains-mono` 5.2.8: Monospace for code/data
- **CSS Structure**: Per-page and component-level CSS files (~105+ new files in recent session)
  - Responsive design with media queries (1011 lines of mobile responsiveness)
  - Mobile-first approach with breakpoints for tablet/desktop

### UI Components & Charts
- **Lucide React 0.577.0**: Icon library
  - 17+ SVG icons used throughout sidebar and UI
  - Lightweight, tree-shakeable icons
- **Recharts 3.7.0**: Data visualization library
  - 6 chart components on analytics dashboard
  - Bar charts, Line charts, Pie charts for reporting
  - Responsive chart containers

### PDF Generation
- **@react-pdf/renderer 4.3.2**: React-based PDF rendering
  - Server-side PDF generation
  - Components: Invoice, Quote, Work Order, Service Report, Form/Report documents
  - Document layout with custom fonts and styling
- **pdfkit 0.17.2**: Additional PDF toolkit (legacy/complementary)
  - Type definitions: `@types/pdfkit` 0.17.4

## Email & Notifications

- **Resend 6.9.1**: Email delivery API
  - Transactional emails: Invites, work order notifications, quotes
  - HTML email templates with embedded styles
  - API-based sending (no SMTP setup required)
  - From address: `noreply@serviceopsiq.com`
- **In-App Notifications**: Custom notification system
  - Database: `Notification` model in Prisma schema
  - Display: React Context-based Toast provider
  - Types: Work order status, PM schedules, quotes, payment confirmations

## Authentication & Security

- **Supabase Auth**: Primary authentication provider
  - Session-based auth via OAuth 2.0 (cookie-based)
  - JWT tokens for API authentication
  - Bearer token support for mobile apps (added in phase C)
  - Server client: `@supabase/ssr` 0.8.0
  - Client library: `@supabase/supabase-js` 2.89.0
- **Portal Auth**: Custom token-based auth for customer portal
  - `CustomerPortalToken` model stores encrypted tokens
  - Token validation with expiry checks
  - Fallback to header-based dev auth (NODE_ENV=development + DEV_AUTH_BYPASS=true only)
- **Rate Limiting**: Custom in-app rate limiter
  - Implementation: Middleware-level IP-based bucketing
  - Tiers: Auth (20/min), Email (10/min), AI (10/min), Export (5/min), General API (100/min)
  - Headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- **CSRF Protection**: Origin-based validation
  - Middleware enforces on POST/PUT/PATCH/DELETE to `/api/*`
  - Allows requests without Origin header (mobile apps)
- **Security Headers** (via `next.config.ts`):
  - `X-Frame-Options: DENY` (prevent clickjacking)
  - `X-Content-Type-Options: nosniff` (prevent MIME sniffing)
  - `Content-Security-Policy` (restrict script/style/resource origins)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`: Restrict camera/microphone/geolocation (except /tech routes)

## Error Tracking & Monitoring

- **Sentry 10.42.0** (`@sentry/nextjs`)
  - Configuration: `next.config.ts` with Sentry wrapper
  - Org: `serviceopsiq` | Project: `serviceopsiq-web`
  - Error capturing for production and preview builds
  - Performance monitoring (transactions)
  - Silent mode enabled (no console spam)
  - Source map upload for error context

## External API Clients

- **Anthropic SDK 0.71.2** (`@anthropic-ai/sdk`)
  - Purpose: AI text generation for work order descriptions, analysis
  - Endpoint integration in work order AI routes
- **Node.js HTTP Client**: `pg` 8.16.3
  - PostgreSQL driver for direct database connections (via Prisma)

## Environment & Configuration

### Environment Variables (Non-Secret Pattern)
All sensitive values stored in Vercel Secrets, never in `.env` files:

**Database**:
- `DATABASE_URL`: Supabase PostgreSQL connection (pooled via PgBouncer)
- `DIRECT_URL`: Supabase PostgreSQL direct connection (for Prisma migrations)

**Authentication**:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY`: Admin-level Supabase key (server-only)

**Email**:
- `RESEND_API_KEY`: Resend email API key (server-only)

**Error Tracking**:
- `SENTRY_AUTH_TOKEN`: Sentry source map upload (build-only)
- `SENTRY_ORG`, `SENTRY_PROJECT`: Sentry project identifiers

**External APIs**:
- `QBO_CLIENT_ID`: QuickBooks OAuth client ID
- `QBO_CLIENT_SECRET`: QuickBooks OAuth secret (server-only)
- `QBO_REDIRECT_URI`: OAuth callback URL
- `QBO_ENVIRONMENT`: `sandbox` | `production`
- `QBO_WEBHOOK_VERIFIER_TOKEN`: HMAC signature verification token

**Cron Jobs**:
- `CRON_SECRET`: Bearer token for Vercel Cron endpoints (server-only)

**Development** (local only, never in production):
- `NODE_ENV`: `development` | `production`
- `DEV_AUTH_BYPASS`: `true` (only in development)
- `DEV_ORG_ID`, `DEV_USER_ID`, `DEV_ROLE`: Fallback local auth (development only)

### Configuration Files

**`tsconfig.json`**:
- TypeScript compilation options
- Path alias: `@/*` → `./src/*`
- Strict mode enabled (nullChecks, strictPropertyInitialization, etc.)
- JSX: `react-jsx` (automatic runtime)

**`next.config.ts`**:
- Sentry integration (error tracking)
- Custom HTTP headers (security, CSP, permissions)
- Rate limiting config (via middleware)
- Canonical host enforcement (production only)

**`vercel.json`**:
- Cron job definition: `/api/cron/generate-pms` at `0 6 * * *` (daily at 6 AM UTC)

**`middleware.ts`**:
- Session refresh via Supabase
- Rate limiting enforcement
- CSRF protection
- Canonical host redirect (production)
- Matcher: all routes except static assets

## Build & Deployment

### Build Command
```bash
npm run build  # Runs: prisma generate && next build
```
- Prisma client generation
- Next.js compilation and bundling
- TypeScript type checking
- Static analysis (ESLint)

### Start Command
```bash
npm start  # Runs: next start
```
- Production server on port 3000
- Optimized for Vercel deployment

### Development Command
```bash
npm run dev  # Runs: next dev
```
- Local development server with hot reload
- Runs on http://localhost:3000
- Source maps enabled for debugging

### Deployment Platform
- **Vercel**: Official Next.js deployment platform
  - Automatic builds on git push
  - Environment secrets management
  - Preview deployments for pull requests
  - Cron job support (via `vercel.json`)
  - Production URL: https://serviceops-ai.vercel.app

## Summary

**Stack Profile**:
- Modern full-stack TypeScript with React + Next.js
- PostgreSQL relational database with Prisma ORM
- Multi-tenant SaaS with role-based access control
- Server-side rendering + API routes (monolithic architecture)
- Security-first: Rate limiting, CSRF, CSP, auth validation, RLS in database
- Error tracking via Sentry for production observability
- Transactional email via Resend
- PDF generation for documents (invoices, quotes, reports)
- QuickBooks Online integration for accounting sync
- Vercel deployment with automatic CI/CD and cron jobs
