# PM Automation System

## Overview
The ServiceOpsIQ PM automation system automatically generates work orders based on scheduled preventive maintenance routines.

## Current Implementation
**Manual Generation Only**
- Users click "Generate Work Order" button on PM schedules
- Work orders created immediately with tasks from procedure templates
- Next scheduled date automatically calculated

## Future Automated Implementation

### Option 1: Vercel Cron Jobs (Recommended for Production)
```typescript
// src/app/api/cron/generate-pms/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Find schedules due for generation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueSchedules = await prisma.workflowDefinition.findMany({
    where: {
      status: 'ACTIVE',
      autoGenerateWorkOrders: true,
      nextScheduledDate: { lte: today },
    },
  });

  // Generate work orders for each due schedule
  for (const schedule of dueSchedules) {
    await generateWorkOrderFromSchedule(schedule.id);
  }

  return Response.json({ generated: dueSchedules.length });
}
```

**Vercel Configuration:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/generate-pms",
    "schedule": "0 6 * * *"
  }]
}
```

### Option 2: External Scheduler (Alternative)
- GitHub Actions scheduled workflow
- AWS Lambda with EventBridge
- Third-party services (Zapier, n8n)

## Manual Generation Flow

1. User navigates to PM schedule detail
2. Clicks "Generate Work Order" button
3. System creates:
   - New work order with PM type
   - Work package for PM tasks
   - Tasks from procedure template (if configured)
   - Updates schedule's lastGeneratedWorkOrderId
   - Calculates and sets nextScheduledDate

## Data Flow
```
PM Schedule -> Generate WO API -> Work Order Created
     |                              |
Update last generated       Create work package
Update next date            Create tasks from template
Increment execution count   Set due date (+7 days)
```

## Compliance Tracking

Compliance Rate = (Completed WOs / Total Generated WOs) x 100

- Tracked per schedule
- Displayed on schedule detail page
- Used for reporting and KPIs

## Integration Points

1. **Assets Page**: "Create PM Schedule" button per asset
2. **Work Orders**: Link back to source PM schedule
3. **Dashboard**: PM compliance widget (future)
4. **Notifications**: Due/overdue PM alerts (future)
