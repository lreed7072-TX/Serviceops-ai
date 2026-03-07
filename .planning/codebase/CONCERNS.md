# ServiceOps AI - Codebase Concerns & Technical Debt

**Generated:** 2026-03-07
**Scope:** Web app (`Serviceops-ai/`) + Mobile app (`serviceops-mobile/`)
**Risk Level:** MEDIUM — Most concerns are manageable pre-launch; some require immediate attention.

---

## 🔴 CRITICAL ISSUES (Must Fix Before Production)

### 1. Rate Limiting Not Deployed
**File:** `src/lib/rate-limit.ts` exists but **unused**
**Risk:** API endpoints are defenseless against brute-force attacks, scraping, DoS attacks
**Status:** Implementation complete but not integrated into any routes
**Impact:** Public production API will be vulnerable

**Action Required:**
- Integrate `checkRateLimit()` into protected API routes (at minimum: auth, form-responses, invoices)
- Test against concurrent requests
- Set CRON_SECRET env var in Vercel (for PM cron job)

---

### 2. Type Safety Issues (108 `as any` Casts)
**Files:**
- `src/app/(app)/work-orders/page.tsx` (12 instances)
- `src/app/(app)/visits/page.tsx` (9 instances)
- `src/app/api/customers/route.ts` (1 instance)
- **Total:** 108 across codebase

**Risk:** Type errors slip through to production; refactoring breaks silently
**Example:**
```typescript
// src/app/(app)/work-orders/page.tsx
(wo as any).workOrderNumber?.toLowerCase().includes(query)
(wo as any).orderType === orderTypeVal
```

**Root Cause:** Prisma query results are weakly typed; UI accesses optional fields
**Action Required:**
- Create proper types for work order, visit, task responses
- Export types from API response handlers
- Replace `as any` with proper union/optional types
- Priority: Fix high-traffic pages first (work-orders, visits)

---

### 3. No Input Validation on JSON Payloads
**Pattern:** `const body = await req.json()` → direct usage (100+ occurrences)
**Files:** Nearly all API routes
**Risk:** Malformed JSON crashes routes; no schema validation

**Example:**
```typescript
// src/app/api/customers/route.ts
const body = await parseJson<CustomerPayload>(request);
if (!body?.name) return jsonError(...);
// Fields are optional but assume shape
```

**Missing:** Zod/Yup schema validation on POST/PUT payloads
**Action Required:**
- Implement schema validation in `lib/api-server.ts` helpers
- Create reusable validators for common types
- Priority: API routes first, then form responses

---

### 4. Unhandled Errors in External API Calls
**File:** `src/lib/qbo/qbo-client.ts` (QBO OAuth, token refresh, API calls)
**Risk:** Silently fails on QBO API errors; tokens may expire without graceful degradation

**Example:**
```typescript
const response = await fetch(QBO_TOKEN_URL, { ... });
// No check on response.ok; no error handling on JSON parse
const tokens = await response.json();
```

**Action Required:**
- Add response status checks in all fetch calls
- Implement token refresh retry logic
- Add timeout handling for external API calls
- Log failures to Sentry

---

## 🟠 HIGH PRIORITY ISSUES

### 5. Unused Rate Limit Utility
**File:** `src/lib/rate-limit.ts`
**Status:** Dead code; not integrated anywhere
**Action:** Either integrate or remove

---

### 6. TODO Comments (Incomplete Feature)
**File:** `src/app/api/work-orders/[id]/ai-generate/route.ts` (line ~50)
```typescript
// TODO: Could also match assetFamily/assetSubfamily if provided
```
**Status:** Procedure template matching only checks `assetCategory`
**Impact:** AI task plans less relevant when asset has specific subfamily
**Action:** Implement subfamily matching for better AI context

---

### 7. Test Coverage: 7 Tests for 343 Source Files (2%)
**Files:** Only `src/__tests__/` has coverage
**Test Count:** 7 test files
**Source Count:** 343 TypeScript files
**Coverage Ratio:** ~2%

**Missing Test Coverage:**
- PDF generation (invoice, quote, work order, form responses)
- QBO OAuth flow & token refresh
- Portal authentication & token validation
- Email templating (Resend integration)
- CRM features (customers, activities)
- Form validation & submission logic

**Action Required:**
- Prioritize critical path: auth, work orders, invoices
- Add integration tests for QBO flow
- Mock Resend for email tests
- Set minimum coverage baseline

---

### 8. Tight Coupling Between APIs & UI Types
**Pattern:** UI imports from API files; no canonical API response types
**Risk:** Schema changes break UI; frontend must understand backend schema

**Example:**
```typescript
// src/components/TaskList.tsx imports Task type directly
// If Prisma Task shape changes, component breaks
```

**Action Required:**
- Create `types/api-responses.ts` for all endpoint responses
- Export from API routes, not from Prisma
- UI only imports from `types/api-responses`

---

## 🟡 MEDIUM PRIORITY ISSUES

### 9. Multi-Tenant Isolation: No RLS on Supabase
**Pattern:** All multi-tenancy is application-level (`orgId` checks)
**Risk:** Prisma bug or missing validation = data leak across orgs

**Checks Performed:**
- ✅ Every query includes `orgId: auth.orgId`
- ✅ Indexes on `orgId` for performance
- ✅ Auth guards on sensitive routes
- ❌ No database-level Row-Level Security (RLS) policy

**Action Recommended (Post-Launch):**
- Add Supabase RLS policies as defense-in-depth
- Requires schema migration + testing

---

### 10. No Graceful Degradation for Portal Tokens
**File:** `src/lib/portal-auth.ts`
**Pattern:** Token validated but no retry/refresh logic
**Risk:** Expired token = immediate 401, poor UX if customer reloads form

**Action Required:**
- Implement token refresh endpoint
- Add refresh-token storage in customer portal
- Handle token expiration gracefully

---

### 11. Query Parameter Validation Missing
**Pattern:** `searchParams.get("limit")` parsed but not validated
**Files:** 10+ API routes

**Example:**
```typescript
// src/app/api/customers/route.ts
const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);
// No validation: negative numbers after Math.max()?
// No check for NaN from parseInt?
```

**Action Required:**
- Create utility: `validatePaginationParams(limit, offset)`
- Use in all list endpoints
- Add unit tests

---

### 12. Async Errors in Frontend
**Pattern:** 54 instances of `.catch()` and `.then()` without standardized error handling
**Risk:** Some errors silently fail; others show generic toasts

**Example:** Task status changes might fail silently in mobile app

**Action Required:**
- Standardize error handling in hooks
- Add error logging to Sentry
- Ensure user feedback for all failures

---

### 13. Password Security in Mobile App
**File:** `src/lib/auth.ts` (mobile)
**Pattern:** Uses Supabase auth, but no password strength validation
**Risk:** Users set weak passwords; credentials stored in SecureStore

**Action Required:**
- Add password strength meter on signup
- Validate minimum entropy before submit
- Document SecureStore threat model

---

### 14. Missing Validation on Enum Fields
**Pattern:** Task.status, WorkOrder.orderType etc. not validated on creation
**Risk:** Invalid enum values could be written to DB

**Example:**
```typescript
// src/app/api/work-orders/[id]/tasks/route.ts
status: TaskStatus.TODO, // Prisma prevents invalid; but what if manual API call?
```

**Action Required:**
- Add Zod enum validation in parsers
- Test with invalid enum values

---

## 🔵 LOW/MEDIUM PRIORITY ISSUES

### 15. Duplicate Status Ordering Logic
**Files:**
- `src/app/(tech)/tech/page.tsx` (line 50)
- `src/app/(tech)/tech/work-orders/[id]/page.tsx` (line 40)
```typescript
const order: Record<string, number> = { IN_PROGRESS: 0, TODO: 1, BLOCKED: 2, DONE: 3, SKIPPED: 4 };
```

**Action:** Extract to `constants/task-order.ts`

---

### 16. Weak Typing in Visited/Scheduled Date Handling
**File:** `src/app/(app)/visits/[id]/page.tsx`
```typescript
setEditScheduledFor(v.scheduledFor ? new Date(v.scheduledFor as any).toISOString().slice(0, 16) : "");
```

**Action:** Create date utility: `formatDateTimeForInput(date: Date | null)`

---

### 17. Inconsistent Error Messages
**Pattern:** Some errors say "Internal server error", some don't specify
**Impact:** Unclear to users what went wrong

**Action Required:**
- Standardize error messages
- Use consistent HTTP status codes
- Document error response format

---

### 18. No Timeout on Long-Running Operations
**Example:** AI task plan generation (`/api/work-orders/[id]/ai-generate`)
**Risk:** Request hangs if Claude API is slow
**Action:** Add timeout wrapper around Anthropic SDK calls

---

### 19. Form Response Auto-Save Debounce (Mobile)
**File:** `serviceops-mobile/src/hooks/useFormResponse.ts`
**Pattern:** Debounced 5s PATCH to API
**Risk:** User loses data if app crashes during debounce window

**Action:** Increase debounce to 10s or add commit button

---

### 20. Missing Image Compression Validation
**File:** `serviceops-mobile/src/lib/camera.ts`
**Pattern:** Photos compressed to 1920px max, JPEG 80%
**Risk:** No file size limit; slow uploads on 3G

**Action Required:**
- Add file size check before upload
- Reject images greater than 5MB
- Show upload progress

---

## 📦 DEPENDENCY RISKS

### 21. All Production Dependencies Up-to-Date
**Status:** ✅ Good
- `next`: 16.1.0 (latest)
- `prisma`: 6.16.0 (latest)
- `react`: 19.2.3 (latest)
- `@sentry/nextjs`: 10.42.0 (recent)

**Minor Risks:**
- `@react-pdf/renderer`: 4.3.2 — Medium maintenance; consider `pdfkit` for server-side
- `recharts`: 3.7.0 — Large bundle; monitor on Vercel Analytics

---

### 22. Missing Dependency Validation
**Pattern:** No lock file checks; no automated dependency audits
**Action:** Enable Dependabot on GitHub

---

## 🔐 SECURITY CONCERNS

### 23. Dev Auth Only Protected by Env Vars
**File:** `src/lib/auth.ts`
**Protection:** `NODE_ENV === "production"` check + DEV_AUTH_BYPASS flag
**Status:** ✅ Good — dev auth completely disabled in prod

---

### 24. Portal Token No Expiration on Creation
**File:** `src/lib/portal-auth.ts`
**Risk:** Portal tokens valid forever unless manually revoked
**Action Required:**
- Add `expiresAt` to `CustomerPortalToken` model
- Validate expiration on each request
- Set reasonable TTL (90 days?)

---

### 25. No CSRF Protection on Forms
**Pattern:** Forms don't include CSRF tokens
**Risk:** Form-based attacks possible (low risk for SPA, but worth verifying)

**Action:** Verify Next.js middleware includes CSRF check

---

### 26. Secrets in Prisma Logs
**Risk:** If `query.log: ["info"]` enabled, SQL queries logged
**Action:** Verify `query.log` disabled in production schema

---

## 📊 PERFORMANCE CONCERNS

### 27. N+1 Query Potential in List Endpoints
**Pattern:** `findMany()` with `include: { _count: {...} }` common
**Example:** `src/app/api/customers/route.ts` counts relationships

**Action Required:**
- Audit for unnecessary includes
- Use `select` instead of `include` when possible
- Test with 10k+ records

---

### 28. Large Pagination Defaults
**Pattern:** Default limit: 50, max: 200
**Risk:** Large result sets could slow API

**Action:** Monitor API response times with Sentry

---

### 29. No Caching on Public Portal Data
**Pattern:** Portal endpoints don't use HTTP caching headers
**Risk:** Customer portal PDFs regenerated on every request

**Action Required:**
- Add `Cache-Control: max-age=3600` to PDF endpoints
- Use ETag for quote/invoice changes

---

### 30. Bundle Size Not Monitored
**Risk:** Production bundle could exceed Next.js targets
**Action:** Enable Next.js Bundle Analyzer; set size limits in CI

---

## 🧪 TESTING & QA GAPS

### 31. No E2E Tests
**Status:** Zero Playwright/Cypress tests
**Impact:** Manual testing for every release

**Action Required:**
- Add 5-10 critical path E2E tests (signup, quote creation, invoice)
- Run in CI on pull requests

---

### 32. No Load Testing
**Risk:** Unknown how API scales under production traffic
**Action:** Use k6 or Artillery to load test before launch

---

## 🚀 DEPLOYMENT & OPERATIONS

### 33. CRON_SECRET Not Set in Production
**File:** `vercel.json` defines PM generation cron
**Status:** Cron will fail if `CRON_SECRET` env var missing
**Action Required:**
- Set `CRON_SECRET` in Vercel dashboard
- Test cron execution
- Monitor with Sentry

---

### 34. No Deployment Checklist
**Risk:** Critical steps forgotten on release
**Action:** Create `DEPLOYMENT.md` with:
- Pre-deploy tests
- Environment variable checklist
- Rollback procedure
- Post-deploy smoke tests

---

### 35. Missing Monitoring Dashboards
**Current:** Sentry for errors only
**Missing:**
- API response time trends
- Database connection pool usage
- QBO API quota usage
- Storage usage (file uploads, PDFs)

**Action:** Create Sentry dashboard for operations team

---

## 📝 ARCHITECTURE CONCERNS

### 36. No API Versioning
**Risk:** Future breaking changes to API break mobile/portal
**Pattern:** All routes at `/api/...` with no version prefix

**Action (Post-Launch):** Plan v2 API with `/api/v2/...`

---

### 37. PDF Generation in-Process on API
**Files:** `src/lib/pdf/*.ts` + API route calls directly
**Risk:** Large PDF generation blocks HTTP thread

**Action (Post-Launch):** Move to async job queue (Bull/RabbitMQ)

---

### 38. No Request/Response Logging
**Pattern:** Only errors logged; request bodies not captured
**Risk:** Difficult to debug customer issues

**Action:** Add structured logging middleware (Pino/Winston)

---

### 39. Portal Auth Uses Hardcoded Cookie Name
**File:** `src/lib/portal-auth.ts` (line 27)
```typescript
if (cookie.startsWith("portal_token=")) { ... }
```

**Risk:** Cookie name not configurable; hard to change without breaking clients
**Action:** Move to config constant

---

## 🔄 INCOMPLETE/MISSING FEATURES

### 40. CRM Module Incomplete
**Status:** Not implemented (on roadmap for post-launch)
**Impact:** No activity tracking, opportunity pipeline, contact management

---

### 41. QuickBooks Integration Incomplete
**Status:** OAuth + sync implemented, but:
- No payment webhook verification
- No error recovery for sync failures
- No manual re-sync trigger

**Action Required:**
- Implement QBO webhook signature verification
- Add manual sync button in settings UI
- Test with real QBO sandbox

---

### 42. Form/Report System Edge Cases
**File:** Mobile form responses
**Known Issues:**
- Calculated fields not validated if dependencies missing
- No handling if form template definition deleted
- Signature base64 encoding could exceed field limits

---

## 📋 CODE QUALITY

### 43. Inconsistent Import Styles
**Pattern:** Mix of default/named imports; inconsistent ordering
**Example:**
```typescript
// Some files
import { foo, bar } from "@/lib";
import type { Type1, Type2 } from "@/lib";

// Others
import type { Type1 } from "@/lib";
import { foo } from "@/lib";
```

**Action:** Configure Eslint import-sort rules

---

### 44. Missing JSDoc Comments
**Pattern:** API route files lack documentation
**Risk:** Unclear parameters, return types, side effects

**Action:** Add JSDoc to all public functions

---

### 45. Inconsistent Error Handling Patterns
**Pattern:** Some routes use try/catch, some use catch blocks
**Example:**
```typescript
// Route 1
try { ... } catch(err) { return jsonError(...) }
// Route 2
.catch(err => { console.error(...); return jsonError(...) })
```

**Action:** Standardize on try/catch pattern

---

## ✅ WHAT'S WORKING WELL

- ✅ Multi-tenant isolation at app layer (consistently applied)
- ✅ Auth guards on all sensitive endpoints
- ✅ Prisma ORM prevents SQL injection
- ✅ No malicious HTML injection patterns
- ✅ Env var protection (dev auth disabled in prod)
- ✅ Database indexes on orgId for performance
- ✅ Sentry integration for error monitoring
- ✅ PWA/offline support in mobile app
- ✅ Form validation for custom reports
- ✅ PDF generation for professional documents

---

## 🎯 PRIORITY MATRIX

| Issue | Category | Severity | Effort | Do Before Launch? |
|-------|----------|----------|--------|-------------------|
| Rate limiting not deployed | Security | CRITICAL | 2h | YES |
| 108 `as any` casts | Type Safety | HIGH | 8h | YES |
| No input validation | Security | CRITICAL | 4h | YES |
| QBO error handling | Integration | HIGH | 3h | YES |
| Test coverage (2%) | Quality | MEDIUM | 20h | NO (post-launch) |
| Portal token expiry | Security | MEDIUM | 2h | YES |
| CRON_SECRET not set | Deployment | CRITICAL | 0.5h | YES |
| Form-response edge cases | Features | MEDIUM | 4h | POST-LAUNCH |
| Load testing | QA | MEDIUM | 4h | NO (close to launch) |
| Monitoring dashboards | Ops | LOW | 4h | NO (post-launch) |

---

## 📌 RECOMMENDED IMMEDIATE ACTIONS (Next 2 Days)

1. **Deploy rate limiting** (2h) — Integrate `checkRateLimit()` into auth + form endpoints
2. **Set CRON_SECRET** (0.5h) — Prevent PM cron from failing in production
3. **Fix critical type issues** (4h) — Prioritize work-orders, visits pages
4. **Add input validation** (2h) — Create Zod schemas for CustomerPayload, TaskPayload
5. **QBO error handling** (2h) — Add response checks and token refresh logic
6. **Test all flows** (3h) — Manual testing of quote to invoice to analytics path

**Estimated Total:** ~13.5 hours before launch

---

## 📞 Questions for Lance / Product

1. Should we implement RLS on Supabase post-launch, or accept application-level isolation?
2. What's the portal token TTL? (recommend 90 days)
3. Is CRON_SECRET already set in Vercel? (must verify)
4. Should we enforce password strength on mobile signup?
5. Do we need API versioning before launch, or is v0 okay?
