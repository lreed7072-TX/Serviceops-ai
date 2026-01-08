# ServiceOps AI - Development Handoff Document
## Generated: January 7, 2026

---

## 🎯 THE VISION

ServiceOps AI is an AI-driven service business management platform specifically designed for **rotating equipment and controls work orders** (pumps, compressors, motors, valves, instrumentation). This is not generic field service software—it's purpose-built for industrial service companies like GPS Pumps.

**The end goal:** A professional, paid SaaS product that streamlines service business operations through:
- Automated task generation from equipment-specific standards
- Mobile-first technician workflows
- Structured measurements and data capture
- Intelligent quoting and job costing
- AI-powered orchestration (future)

---

## 🏗️ TECHNICAL ARCHITECTURE

### Stack
- **Frontend:** Next.js 16.1 (App Router, React 19)
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma 6.16+
- **Auth:** Supabase Auth (email/password)
- **Deployment:** Vercel (auto-deploy from GitHub)
- **Styling:** Custom CSS (globals.css), minimal dependencies

### Repository
- **GitHub:** https://github.com/lreed7072-TX/Serviceops-ai.git
- **Production URL:** https://serviceops-ai.vercel.app
- **Branch:** main (direct push, no PRs)

### Database Connection
```
Production: postgresql://postgres:GPSpumps101@db.gnhcvbovwmrqsjuagxgs.supabase.co:5432/postgres
```

### Key Directories
```
/src/app/(app)/          → Admin UI pages (dashboard, work-orders, quotes, etc.)
/src/app/(tech)/         → Technician mobile UI
/src/app/api/            → API routes
/src/components/         → Shared React components
/src/lib/                → Utilities (auth.ts, api.ts, prisma.ts)
/prisma/schema.prisma    → Database schema (SINGLE SOURCE OF TRUTH)
```

### Test User
- **Email:** lance@gpspumps.com
- **User ID:** 15697c8e-edfb-4241-9adc-ff8376d19e53
- **Role:** TECH
- **Org:** GPS Pumps

---

## ✅ COMPLETED FEATURES (All Deployed & Working)

### 1. Standards Packs
Reusable task templates for equipment types. Full CRUD, auto-generates tasks when applied to work orders.
- `/api/standards-packs/` and `/api/standards-packs/[id]/`
- `/app/(app)/standards-packs/`

### 2. Measurements System
Structured data capture: numeric values with ranges, pass/fail, text entries. Integrated into standards packs and technician task execution.
- Measurement definitions in StandardTaskTemplate
- MeasurementValue model for captured data

### 3. Material Usage Tracking
Technicians log parts used per task. Pulls from material catalog with cost tracking.
- `/api/tasks/[id]/materials/`
- Material catalog at `/api/materials/`

### 4. Timer System
Start/pause/resume/stop with automatic task status integration.
- `/api/tech/timer/`
- TimeEntry model tracks all time

### 5. Signatures
Digital signature capture for tech and customer sign-off on work orders.
- SignaturePad component
- `/api/work-orders/[id]/signatures/`
- Signature model with signedAt, signerName, signatureType

### 6. Order Types (WO/SO/PJ)
Work Orders, Service Orders, and Projects differentiated by OrderType enum.
- Schema uses `orderType` field on WorkOrder model
- UI shows type badges, form has selector

### 7. Quotes Module (JUST COMPLETED)
Full quoting system with line items, pricing, material catalog integration, and conversion to orders.

**Schema:**
- Quote model (status: DRAFT→SENT→APPROVED/REJECTED→CONVERTED)
- QuoteLineItem model (LABOR, MATERIAL, SERVICE, OTHER types)

**APIs:**
- `/api/quotes/` - List/Create quotes
- `/api/quotes/[id]/` - Get/Update/Delete quote
- `/api/quotes/[id]/line-items/` - Manage line items
- `/api/quotes/[id]/actions/` - Send, approve, reject, convert to WO/SO/PJ

**UI:**
- `/app/(app)/quotes/page.tsx` - Complete form with:
  - Customer/Site selection
  - Labor rate & material markup settings
  - Line item builder (type, description, qty, unit price)
  - Material catalog dropdown for quick selection
  - Auto-calculated subtotal/tax/total
  - Notes and terms fields
- `/app/(app)/quotes/[id]/page.tsx` - Detail/edit page with status workflow

**Latest Commit:** `abbc021` - "Quotes: complete form with line items, pricing, totals, material catalog"

---

## 🔧 CRITICAL PATTERNS & LESSONS LEARNED

### Authentication Pattern (MUST FOLLOW)
Every API route MUST use this exact pattern:
```typescript
import { requireAuthSessionFirst } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  
  // Now use auth.orgId, auth.userId, auth.role
}
```

**DO NOT** use `if ("status" in auth)` - this caused hours of debugging.

### Prisma Schema Field Names
ALWAYS check `schema.prisma` before writing queries. Recent bugs:
- Material uses `partNumber`, not `sku`
- Quote relation is `createdBy`, not `createdByUser`
- Signature relation is `capturedBy`, not `capturedByUser`
- Signature timestamp is `signedAt`, not `capturedAt`

### Multi-Tenant Data Isolation
Every query MUST filter by `orgId`:
```typescript
await prisma.workOrder.findMany({
  where: { orgId: auth.orgId }
});
```

### Deployment Process
1. Make changes locally
2. `git add -A && git commit -m "message" && git push`
3. Vercel auto-deploys from GitHub
4. Check deployment status via Vercel MCP tool
5. If ERROR, check build logs for TypeScript errors
6. Fix and push again

### PowerShell for Prisma
When running Prisma commands with env vars on Windows:
```powershell
$env:DATABASE_URL="connection_string"; npx prisma db push
```

---

## 🚀 NEXT PRIORITIES

### Immediate
1. **Test Quotes Workflow** - Create quote, add items, send, approve, convert to WO
2. **Quote Detail Page Polish** - Ensure edit/view works properly

### Short-term
3. **UI Professional Overhaul** - Current interfaces need refinement for paid product
4. **Dashboard Metrics** - Real KPIs and charts

### Medium-term
5. **AI Orchestrator** - Intelligent automation layer
6. **Reporting System** - Professional reports and exports
7. **Customer Portal** - External access for customers

---

## 💡 WORKING STYLE PREFERENCES

From user preferences and established patterns:

1. **Be direct and straightforward** - No fluff, get to the point
2. **Double-check before answering** - Verify schema fields, check existing code patterns
3. **No unauthorized changes** - Ask before making changes outside explicit scope
4. **Ask permission before changing** - Don't assume, confirm
5. **Ultrathink approach** - Question assumptions, obsess over details, plan before coding
6. **Complete features fully** - Don't leave half-baked forms (like the original quotes page)
7. **Test after deploying** - Verify builds succeed and features work
8. **Use Desktop Commander & Filesystem tools** - Direct file access on Windows PC

---

## 📁 KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| `/prisma/schema.prisma` | Database schema - CHECK THIS FIRST |
| `/src/lib/auth.ts` | Authentication helpers |
| `/src/lib/api.ts` | API fetch wrapper |
| `/src/lib/prisma.ts` | Prisma client singleton |
| `/src/app/(app)/layout.tsx` | Admin layout with sidebar nav |
| `/src/app/globals.css` | All styling |

---

## 🔗 MCP TOOLS AVAILABLE

- **Vercel MCP** - Deploy, check status, get logs
- **Desktop Commander** - File operations, process execution
- **Filesystem** - Read/write files on user's Windows PC
- **GitHub MCP** - Repository access

---

## ⚠️ GOTCHAS TO REMEMBER

1. **Vercel Turbopack** - Builds are fast but TypeScript errors block deployment
2. **Prisma generate** - Runs automatically on Vercel build
3. **Schema changes** - Use `prisma db push` locally, Vercel handles production
4. **Auth user ID mismatch** - Supabase auth ID must match Prisma User.id (UUID)
5. **File paths** - User's project is at: `C:\Users\LanceReed\OneDrive - Global Pump Solutions\Documents\Lance Projects TechIQ Tech\ServiceOpsIQ program\Serviceops-ai\`

---

## 📊 VERCEL PROJECT INFO

- **Project ID:** prj_qvHjyMdk9IESTlx0q9TQl3JVM5Hs
- **Team ID:** team_0oJiDU37oxfAXkrZYDPPtfy1
- **Latest Deployment:** dpl_598d9dAGaEPTPBwdkvkjrF77WDJA (READY)

---

*This handoff document was generated to ensure continuity across Claude context windows. The new session should have everything needed to continue development seamlessly.*
