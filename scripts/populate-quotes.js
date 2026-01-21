const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating quotes...\n');

  const org = await prisma.org.findFirst();
  const techUser = await prisma.user.findFirst();
  const customers = await prisma.customer.findMany({ where: { orgId: org.id }, take: 10 });
  const sites = await prisma.site.findMany({ where: { orgId: org.id }, take: 10 });

  const now = new Date();
  let quoteCount = 0;

  // Create 5 APPROVED/CONVERTED quotes
  for (let i = 0; i < 5; i++) {
    const customer = customers[i % customers.length];
    const site = sites.find(s => s.customerId === customer.id) || sites[0];
    
    const laborAmount = (Math.random() * 1500 + 800).toFixed(2);
    const materialAmount = (Math.random() * 1200 + 400).toFixed(2);
    const subtotal = (parseFloat(laborAmount) + parseFloat(materialAmount)).toFixed(2);
    const tax = (parseFloat(subtotal) * 0.0825).toFixed(2);
    const total = (parseFloat(subtotal) + parseFloat(tax)).toFixed(2);
    
    const daysAgo = Math.floor(Math.random() * 45) + 5;
    const createdDate = new Date(now);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    
    const sentDate = new Date(createdDate);
    sentDate.setDate(sentDate.getDate() + 2);
    
    const approvedDate = new Date(sentDate);
    approvedDate.setDate(approvedDate.getDate() + Math.floor(Math.random() * 5) + 1);

    await prisma.quote.create({
      data: {
        quoteNumber: `QTE-${String(1000 + i).padStart(5, '0')}`,
        title: `Equipment Service Quote - ${customer.name}`,
        description: 'Preventive maintenance and repairs',
        customerId: customer.id,
        siteId: site.id,
        status: i < 3 ? 'APPROVED' : 'CONVERTED',
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        taxRate: 8.25,
        total: parseFloat(total),
        validUntil: new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        sentAt: sentDate,
        approvedAt: approvedDate,
        approvedByName: `${customer.name} Maintenance Manager`,
        createdByUserId: techUser.id,
        orgId: org.id,
        createdAt: createdDate,
        lineItems: {
          create: [
            {
              orgId: org.id,
              itemType: 'LABOR',
              description: 'Service labor - estimated 8 hours',
              quantity: 8,
              unitPrice: parseFloat(laborAmount) / 8,
              totalPrice: parseFloat(laborAmount),
              sortOrder: 1,
            },
            {
              orgId: org.id,
              itemType: 'MATERIAL',
              description: 'Parts and materials',
              quantity: 1,
              unitPrice: parseFloat(materialAmount),
              totalPrice: parseFloat(materialAmount),
              sortOrder: 2,
            },
          ],
        },
      },
    });
    quoteCount++;
  }

  // Create 3 SENT/PENDING quotes
  for (let i = 0; i < 3; i++) {
    const customer = customers[(i + 5) % customers.length];
    const site = sites.find(s => s.customerId === customer.id) || sites[0];
    
    const laborAmount = (Math.random() * 2000 + 1000).toFixed(2);
    const materialAmount = (Math.random() * 1500 + 600).toFixed(2);
    const subtotal = (parseFloat(laborAmount) + parseFloat(materialAmount)).toFixed(2);
    const tax = (parseFloat(subtotal) * 0.0825).toFixed(2);
    const total = (parseFloat(subtotal) + parseFloat(tax)).toFixed(2);
    
    const daysAgo = Math.floor(Math.random() * 20) + 1;
    const createdDate = new Date(now);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    
    const sentDate = new Date(createdDate);
    sentDate.setDate(sentDate.getDate() + 1);

    await prisma.quote.create({
      data: {
        quoteNumber: `QTE-${String(2000 + i).padStart(5, '0')}`,
        title: `Major Service Quote - ${customer.name}`,
        description: 'Equipment overhaul proposal',
        customerId: customer.id,
        siteId: site.id,
        status: 'SENT',
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        taxRate: 8.25,
        total: parseFloat(total),
        validUntil: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        sentAt: sentDate,
        createdByUserId: techUser.id,
        orgId: org.id,
        createdAt: createdDate,
        lineItems: {
          create: [
            {
              orgId: org.id,
              itemType: 'LABOR',
              description: 'Overhaul labor - 12-16 hours',
              quantity: 14,
              unitPrice: parseFloat(laborAmount) / 14,
              totalPrice: parseFloat(laborAmount),
              sortOrder: 1,
            },
            {
              orgId: org.id,
              itemType: 'MATERIAL',
              description: 'Replacement components',
              quantity: 1,
              unitPrice: parseFloat(materialAmount),
              totalPrice: parseFloat(materialAmount),
              sortOrder: 2,
            },
          ],
        },
      },
    });
    quoteCount++;
  }

  // Create 2 REJECTED quotes
  for (let i = 0; i < 2; i++) {
    const customer = customers[(i + 8) % customers.length];
    const site = sites.find(s => s.customerId === customer.id) || sites[0];
    
    const laborAmount = (Math.random() * 3000 + 1500).toFixed(2);
    const materialAmount = (Math.random() * 2000 + 800).toFixed(2);
    const subtotal = (parseFloat(laborAmount) + parseFloat(materialAmount)).toFixed(2);
    const tax = (parseFloat(subtotal) * 0.0825).toFixed(2);
    const total = (parseFloat(subtotal) + parseFloat(tax)).toFixed(2);
    
    const daysAgo = Math.floor(Math.random() * 35) + 10;
    const createdDate = new Date(now);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    
    const sentDate = new Date(createdDate);
    sentDate.setDate(sentDate.getDate() + 1);
    
    const rejectedDate = new Date(sentDate);
    rejectedDate.setDate(rejectedDate.getDate() + Math.floor(Math.random() * 8) + 2);

    await prisma.quote.create({
      data: {
        quoteNumber: `QTE-${String(3000 + i).padStart(5, '0')}`,
        title: `System Upgrade Quote - ${customer.name}`,
        description: 'Complete system replacement',
        customerId: customer.id,
        siteId: site.id,
        status: 'REJECTED',
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        taxRate: 8.25,
        total: parseFloat(total),
        validUntil: new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        sentAt: sentDate,
        rejectedAt: rejectedDate,
        rejectionReason: 'Budget constraints',
        createdByUserId: techUser.id,
        orgId: org.id,
        createdAt: createdDate,
        lineItems: {
          create: [
            {
              orgId: org.id,
              itemType: 'LABOR',
              description: 'Installation labor - 20+ hours',
              quantity: 24,
              unitPrice: parseFloat(laborAmount) / 24,
              totalPrice: parseFloat(laborAmount),
              sortOrder: 1,
            },
            {
              orgId: org.id,
              itemType: 'MATERIAL',
              description: 'New equipment',
              quantity: 1,
              unitPrice: parseFloat(materialAmount),
              totalPrice: parseFloat(materialAmount),
              sortOrder: 2,
            },
          ],
        },
      },
    });
    quoteCount++;
  }

  const allQuotes = await prisma.quote.findMany({ where: { orgId: org.id } });
  const totalValue = allQuotes.reduce((sum, q) => sum + q.total.toNumber(), 0);
  const approvedValue = allQuotes.filter(q => q.status === 'APPROVED' || q.status === 'CONVERTED').reduce((sum, q) => sum + q.total.toNumber(), 0);

  console.log('═══════════════════════════════════════');
  console.log('✅ QUOTES CREATED!');
  console.log('═══════════════════════════════════════');
  console.log(`Total Quotes: ${allQuotes.length}`);
  console.log(`  - Approved/Converted: ${allQuotes.filter(q => q.status === 'APPROVED' || q.status === 'CONVERTED').length}`);
  console.log(`  - Sent/Pending: ${allQuotes.filter(q => q.status === 'SENT').length}`);
  console.log(`  - Rejected: ${allQuotes.filter(q => q.status === 'REJECTED').length}`);
  console.log(`Total Pipeline Value: $${totalValue.toFixed(2)}`);
  console.log(`Approved Value: $${approvedValue.toFixed(2)}`);
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
