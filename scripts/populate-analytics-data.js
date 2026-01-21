const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Populating analytics data...\n');

  const org = await prisma.org.findFirst();
  const techUser = await prisma.user.findFirst();
  console.log(`✓ Org: ${org.name}, User: ${techUser.name}\n`);

  // Create 5 customers
  console.log('📋 Creating customers...');
  await prisma.customer.createMany({
    data: [
      { name: 'Acme Manufacturing', primaryEmail: 'maint@acmemfg.com', primaryPhone: '817-555-0101', orgId: org.id },
      { name: 'Texas Oil & Gas', primaryEmail: 'ops@texasoil.com', primaryPhone: '817-555-0102', orgId: org.id },
      { name: 'ChemCorp Industries', primaryEmail: 'facilities@chemcorp.com', primaryPhone: '817-555-0103', orgId: org.id },
      { name: 'Water Works', primaryEmail: 'maint@waterworks.com', primaryPhone: '817-555-0104', orgId: org.id },
      { name: 'Food Processing', primaryEmail: 'service@foodproc.com', primaryPhone: '817-555-0105', orgId: org.id },
    ]
  });
  const customers = await prisma.customer.findMany({ where: { orgId: org.id }, take: 5 });
  console.log(`✓ ${customers.length} customers\n`);

  // Create sites
  console.log('🏭 Creating sites...');
  for (const c of customers) {
    await prisma.site.create({
      data: { name: `${c.name} - Main`, orgId: org.id, customerId: c.id }
    });
  }
  const sites = await prisma.site.findMany({ where: { orgId: org.id }, take: 5 });
  console.log(`✓ ${sites.length} sites\n`);

  // Create materials
  console.log('🔧 Creating materials...');
  await prisma.material.createMany({
    data: [
      { name: 'Mechanical Seal', partNumber: 'SEAL-100', unitCost: 299.99, unit: 'each', quantityOnHand: 25, minQuantity: 10, orgId: org.id },
      { name: 'Bronze Impeller', partNumber: 'IMP-8', unitCost: 450, unit: 'each', quantityOnHand: 12, minQuantity: 5, orgId: org.id },
      { name: 'Bearing 6309', partNumber: 'BRG-6309', unitCost: 85, unit: 'each', quantityOnHand: 48, minQuantity: 20, orgId: org.id },
    ]
  });
  console.log(`✓ 3 materials\n`);

  // Create work orders (8 completed, 3 in-progress, 2 open)
  console.log('📝 Creating work orders...');
  const now = new Date();
  let woCount = 0;

  for (let i = 0; i < 8; i++) {
    const c = customers[i % customers.length];
    const s = sites[i % sites.length];
    const daysAgo = Math.floor(Math.random() * 30) + 1;
    const createdDate = new Date(now);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    
    await prisma.workOrder.create({
      data: {
        title: `Pump Maintenance - ${c.name}`,
        description: 'Routine service',
        status: 'COMPLETED',
        customerId: c.id,
        siteId: s.id,
        orgId: org.id,
        createdAt: createdDate,
      }
    });
    woCount++;
  }

  for (let i = 0; i < 3; i++) {
    const c = customers[i % customers.length];
    const s = sites[i % sites.length];
    await prisma.workOrder.create({
      data: {
        title: `Emergency Repair - ${c.name}`,
        description: 'Urgent repair',
        status: 'IN_PROGRESS',
        customerId: c.id,
        siteId: s.id,
        orgId: org.id,
      }
    });
    woCount++;
  }

  for (let i = 0; i < 2; i++) {
    const c = customers[i % customers.length];
    const s = sites[i % sites.length];
    await prisma.workOrder.create({
      data: {
        title: `Scheduled Service - ${c.name}`,
        description: 'Planned maintenance',
        status: 'OPEN',
        customerId: c.id,
        siteId: s.id,
        orgId: org.id,
      }
    });
    woCount++;
  }
  console.log(`✓ ${woCount} work orders\n`);

  console.log('═══════════════════════════════════════');
  console.log('✅ DATA POPULATED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════');
  console.log(`Customers: ${customers.length}`);
  console.log(`Sites: ${sites.length}`);
  console.log(`Materials: 3`);
  console.log(`Work Orders: ${woCount}`);
  console.log('═══════════════════════════════════════\n');
  console.log('🎉 Refresh https://serviceops-ai.vercel.app/analytics');
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
