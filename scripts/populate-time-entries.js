const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding time entries to work orders...\n');

  const org = await prisma.org.findFirst();
  const techUser = await prisma.user.findFirst();
  
  // Get completed work orders without time entries
  const workOrders = await prisma.workOrder.findMany({
    where: { 
      orgId: org.id,
      status: 'COMPLETED',
    },
    include: {
      timeEntries: true,
    },
  });

  console.log(`Found ${workOrders.length} completed work orders\n`);

  let timeEntryCount = 0;

  for (const wo of workOrders) {
    // Skip if already has time entries
    if (wo.timeEntries.length > 0) {
      console.log(`  ⏭️  WO ${wo.id.slice(0, 8)} already has time entries`);
      continue;
    }

    // Create 1-3 time entries per work order (different days/sessions)
    const numEntries = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numEntries; i++) {
      const hoursWorked = Math.random() * 4 + 2; // 2-6 hours per entry
      const accumulatedSeconds = Math.floor(hoursWorked * 3600);
      
      const startedAt = new Date(wo.createdAt);
      startedAt.setHours(startedAt.getHours() + (i * 8)); // Spread entries across time
      
      const stoppedAt = new Date(startedAt);
      stoppedAt.setSeconds(stoppedAt.getSeconds() + accumulatedSeconds);
      
      await prisma.timeEntry.create({
        data: {
          orgId: org.id,
          userId: techUser.id,
          workOrderId: wo.id,
          status: 'STOPPED',
          startedAt: startedAt,
          stoppedAt: stoppedAt,
          accumulatedSeconds: accumulatedSeconds,
          notes: `Field service work - ${hoursWorked.toFixed(1)} hours`,
        },
      });
      
      timeEntryCount++;
    }
    
    console.log(`  ✓ Added ${numEntries} time entries to WO ${wo.id.slice(0, 8)}`);
  }

  console.log(`\n✅ Created ${timeEntryCount} time entries`);
  
  // Calculate total hours
  const allEntries = await prisma.timeEntry.findMany({
    where: { orgId: org.id },
  });
  
  const totalSeconds = allEntries.reduce((sum, entry) => sum + entry.accumulatedSeconds, 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  
  console.log(`📊 Total labor hours: ${totalHours} hours\n`);
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
