# ServiceOps AI - Platform Architecture

## Overview
ServiceOps AI is a multi-tenant SaaS platform for managing service operations, specifically designed for rotating equipment and controls work orders. Built with Next.js 16, Prisma, Supabase, and deployed on Vercel.

## Technology Stack

### Core Framework
- **Frontend**: Next.js 16 (App Router with TypeScript)
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma 6.x
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

### Key Dependencies
- React 18+
- TypeScript 5.x
- Next.js 16.1.0
- Prisma 6.19.1
- Supabase client libraries

## Architecture Patterns

### Multi-Tenancy
**Organization-based isolation:**
- Every data model includes `orgId` field
- All queries automatically scoped to user's organization
- Row-level security enforced at application layer
- Separate `user_org_roles` junction table for role management

### Authentication Flow
```typescript
// Standard auth pattern in API routes:
const authResult = await requireAuthSessionFirst(request);
if ("error" in authResult) return authResult.error;
const { auth } = authResult;
// auth contains: { userId, orgId, role }
```

### Database Access
**Two authentication approaches:**
1. **Supabase Auth User ID** - For user-specific queries
2. **Prisma User ID** - For application data relationships

**Critical:** Supabase auth users map to Prisma users via ID, but queries must use correct context.

### API Route Structure
```
src/app/api/
├── [resource]/
│   ├── route.ts          # GET (list), POST (create)
│   ├── [id]/
│   │   └── route.ts      # GET (detail), PATCH (update), DELETE
```

**Standard response helpers:**
```typescript
function jsonResponse(data: any, status = 200)
function jsonError(error: string, status = 400)
```

## Data Models

### Core Entities
1. **Org** - Organization/tenant
2. **User** - Application users
3. **Customer** - Service customers
4. **Site** - Customer locations
5. **Asset** - Equipment at sites
6. **WorkOrder** - Service work orders
7. **TaskInstance** - Work order tasks
8. **Material** - Parts/materials inventory
9. **Invoice** - Billing documents
10. **Quote** - Pre-work estimates

### Key Relationships
```
Org → Users → WorkOrders → Tasks → Materials
  ↓      ↓         ↓          ↓
Customers → Sites → Assets    TimeEntries
```

### Enum Values (Common Gotchas)
- **WorkOrderStatus**: OPEN, IN_PROGRESS, COMPLETED, CANCELED
- **TaskStatus**: TODO, IN_PROGRESS, DONE, BLOCKED, SKIPPED
- **InvoiceStatus**: DRAFT, SENT, PAID, OVERDUE, CANCELED
- **QuoteStatus**: DRAFT, SENT, APPROVED, REJECTED, EXPIRED, CONVERTED, CANCELED
- **InvoiceLineItemType**: LABOR, MATERIAL, SERVICE, OTHER (NO "PART")

### Field Naming Conventions
**Watch out for these:**
- Invoice: `createdAt` (NOT `invoiceDate`)
- WorkOrder: `workOrderNumber` (NOT `woNumber`)
- TimeEntry: `accumulatedSeconds` (NOT `durationMinutes`)
- Task completion: Check for `status === "DONE"` (NOT "COMPLETED")

## Database Operations

### Migration Workflow
```bash
# Preferred approach (handles drift):
npx prisma db push

# Alternative (strict migrations):
npx prisma migrate dev --name description
```

### Environment Variables
```bash
# Local development (PowerShell):
$env:DATABASE_URL="postgresql://..."

# Or use .env file:
DATABASE_URL="postgresql://..."
```

### Prisma Client Usage
```typescript
import { prisma } from "@/lib/prisma";

// Always scope by orgId:
const records = await prisma.workOrder.findMany({
  where: { orgId: auth.orgId },
});
```

## Deployment

### Environments
- **Staging**: Local development → Staging Supabase
- **Production**: Vercel → Production Supabase

### Build Process
```bash
npm run build  # Runs: prisma generate && next build
```

### Common Build Issues
1. **Schema mismatches**: Field names must exactly match Prisma schema
2. **Enum values**: Use exact enum values from schema
3. **TypeScript null checks**: Use variable capture for null-safety across callbacks
4. **Import patterns**: Use named imports for prisma, requireAuthSessionFirst

## Project Structure
```
src/
├── app/
│   ├── (authenticated)/    # Protected routes
│   │   ├── analytics/
│   │   ├── customers/
│   │   ├── invoices/
│   │   ├── inventory/
│   │   ├── materials/
│   │   ├── quotes/
│   │   └── work-orders/
│   ├── api/               # API routes
│   └── (public)/          # Public routes
├── lib/
│   ├── auth.ts           # Authentication utilities
│   └── prisma.ts         # Prisma client
prisma/
└── schema.prisma         # Database schema
```

## Key Features

### Completed Systems
✅ Authentication & Multi-tenancy  
✅ Customer & Site Management  
✅ Work Orders & Tasks  
✅ Standards Packs (Reusable task templates)  
✅ Time Tracking  
✅ Material Management  
✅ Inventory Tracking & Stock Movements  
✅ Quote/Estimates with Conversion  
✅ Invoicing System  
✅ Analytics & Reporting  
✅ Analytics Export (CSV)

### Complete Business Flow
```
Quote → Work Order → Task Execution → Material Usage → Invoice → Analytics
```

## Development Guidelines

### Code Patterns
**TypeScript Type Safety:**
```typescript
// ✅ CORRECT: Explicit type for enum state
interface FormState {
  status: MyEnum;
}
const [form, setForm] = useState<FormState>({ status: MyEnum.VALUE });

// ❌ WRONG: TypeScript infers literal type
const [form, setForm] = useState({ status: MyEnum.VALUE });
```

**Null Safety in Callbacks:**
```typescript
// ✅ CORRECT: Capture value first
const assignedTo = task.assignedTo;
if (assignedTo) {
  items.find(item => item.id === assignedTo.id);
}

// ❌ WRONG: TypeScript can't track through callback
if (task.assignedTo) {
  items.find(item => item.id === task.assignedTo.id); // Error!
}
```

### API Response Pattern
```typescript
export async function GET(request: NextRequest) {
  // 1. Authenticate
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  
  // 2. Check permissions (if needed)
  if (auth.role !== "ADMIN") {
    return jsonError("Unauthorized", 403);
  }
  
  // 3. Query with org scoping
  const data = await prisma.resource.findMany({
    where: { orgId: auth.orgId },
  });
  
  // 4. Return response
  return jsonResponse({ data });
}
```

## Security Considerations

### Data Isolation
- **Every query MUST filter by orgId**
- No cross-tenant data access
- Role-based access control (ADMIN, TECH, VIEWER)

### Sensitive Operations
- Password changes require current password
- Email changes require verification
- Role changes require ADMIN permission
- Org deletion requires OWNER permission

## Performance Optimization

### Database Indexes
Schema includes strategic indexes on:
- orgId (all models)
- Foreign keys
- Frequently queried fields (status, dates)

### Query Optimization
- Use select to limit returned fields
- Include only necessary relations
- Paginate large result sets
- Use aggregations at database level

## Common Issues & Solutions

### Issue: "Property doesn't exist on type"
**Solution:** Check Prisma schema - field names must match exactly

### Issue: "Enum type mismatch"
**Solution:** Use exact enum values from schema (e.g., DONE not COMPLETED for TaskStatus)

### Issue: "Migration drift detected"
**Solution:** Use `prisma db push` instead of `migrate dev`

### Issue: TypeScript null-check fails in callback
**Solution:** Capture value in const before using in callback

## Next Steps / Roadmap

**Potential Enhancements:**
1. Advanced charting (Chart.js, Recharts)
2. Email notifications
3. Mobile app (React Native)
4. PDF report generation
5. Automated alerts
6. Equipment maintenance scheduling
7. Field technician mobile app
8. Customer portal

## Support & Resources

**Documentation:**
- Prisma Docs: https://www.prisma.io/docs
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs

**Code Repository:** [Your GitHub URL]
**Deployment:** Vercel Dashboard
