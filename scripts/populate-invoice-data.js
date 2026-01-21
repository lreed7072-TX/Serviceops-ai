const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Populating COMPLETE analytics data...\n');

  const org = await prisma.org.findFirst();
  const techUser = await prisma.user.findFirst();
  console.log(`✓ Org: ${org.name}, User: ${techUser.name}\n`);

  // Get existing data
  const customers = await prisma.customer.findMany({ where: { orgId: org.id }, take: 10 });
  const sites = await prisma.site.findMany({ where: { orgId: org.id }, take: 10 });
  const workOrders = await prisma.workOrder.findMany({ where: { orgId: org.id, status: 'COMPLETED' }, take: 10 });
  
  console.log(`Found: ${customers.length} customers, ${sites.length} sites, ${workOrders.length} work orders\n`);

  if (customers.length === 0 || sites.length === 0) {
    console.log('❌ No customers/sites found. Run the populate script first.');
    return;
  }

  // Create invoices with line items
  console.log('🧾 Creating invoices with line items...');
  const now = new Date();
  let invoiceCount = 0;

  for (let i = 0; i < Math.min(10, workOrders.length); i++) {
    const wo = workOrders[i];
    const isPaid = Math.random() > 0.3; // 70% paid
    
    const laborAmount = (Math.random() * 800 + 200).toFixed(2);
    const materialAmount = (Math.random() * 600 + 100).toFixed(2);
    const subtotal = (parseFloat(laborAmount) + parseFloat(materialAmount)).toFixed(2);
    const tax = (parseFloat(subtotal) * 0.0825).toFixed(2);
    const total = (parseFloat(subtotal) + parseFloat(tax)).toFixed(2);
    
    const daysAgo = Math.floor(Math.random() * 25) + 1;
    const createdDate = new Date(now);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    
    let paidAt = null;
    if (isPaid) {
      paidAt = new Date(createdDate);
      paidAt.setDate(paidAt.getDate() + Math.floor(Math.random() * 10) + 3);
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${String(1000 + i).padStart(5, '0')}`,
        title: `Service Invoice - ${wo.title}`,
        description: 'Field service work completed',
        customerId: wo.customerId,
        siteId: wo.siteId,
        workOrderId: wo.id,
        status: isPaid ? 'PAID' : (Math.random() > 0.5 ? 'SENT' : 'OVERDUE'),
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        taxRate: 8.25,
        total: parseFloat(total),
        dueDate: new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        paidAt: paidAt,
        createdByUserId: techUser.id,
        orgId: org.id,
        createdAt: createdDate,
        lineItems: {
          create: [
            {
              orgId: org.id,
              itemType: 'LABOR',
              description: 'Field technician labor - 4 hours',
              quantity: 4,
              unitPrice: parseFloat(laborAmount) / 4,
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
    invoiceCount++;
  }
  
  console.log(`✓ Created ${invoiceCount} invoices with line items\n`);

  // Create additional invoices for customers without work orders
  console.log('📄 Creating standalone invoices...');
  for (let i = 0; i < 5; i++) {
    const customer = customers[i % customers.length];
    const site = sites.find(s => s.customerId === customer.id) || sites[0];
    const isPaid = i < 3; // First 3 are paid
    
    const laborAmount = (Math.random() * 1200 + 400).toFixed(2);
    const materialAmount = (Math.random() * 800 + 200).toFixed(2);
    const subtotal = (parseFloat(laborAmount) + parseFloat(materialAmount)).toFixed(2);
    const tax = (parseFloat(subtotal) * 0.0825).toFixed(2);
    const total = (parseFloat(subtotal) + parseFloat(tax)).toFixed(2);
    
    const daysAgo = Math.floor(Math.random() * 45) + 5;
    const createdDate = new Date(now);
    createdDate.setDate(createdDate.getDate() - daysAgo);
    
    let paidAt = null;
    if (isPaid) {
      paidAt = new Date(createdDate);
      paidAt.setDate(paidAt.getDate() + Math.floor(Math.random() * 12) + 2);
    }

    await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${String(2000 + i).padStart(5, '0')}`,
        title: `Equipment Service - ${customer.name}`,
        description: 'Routine maintenance service',
        customerId: customer.id,
        siteId: site.id,
        status: isPaid ? 'PAID' : 'SENT',
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        taxRate: 8.25,
        total: parseFloat(total),
        dueDate: new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        paidAt: paidAt,
        createdByUserId: techUser.id,
        orgId: org.id,
        createdAt: createdDate,
        lineItems: {
          create: [
            {
              orgId: org.id,
              itemType: 'LABOR',
              description: 'Maintenance labor - 6 hours',
              quantity: 6,
              unitPrice: parseFloat(laborAmount) / 6,
              totalPrice: parseFloat(laborAmount),
              sortOrder: 1,
            },
            {
              orgId: org.id,
              itemType: 'MATERIAL',
              description: 'Replacement parts',
              quantity: 1,
              unitPrice: parseFloat(materialAmount),
              totalPrice: parseFloat(materialAmount),
              sortOrder: 2,
            },
          ],
        },
      },
    });
    invoiceCount++;
  }
  
  console.log(`✓ Created 5 more standalone invoices\n`);

  // Summary
  const allInvoices = await prisma.invoice.findMany({ where: { orgId: org.id } });
  const totalRevenue = allInvoices.reduce((sum, inv) => sum + inv.total.toNumber(), 0);
  const paidRevenue = allInvoices.filter(i => i.status === 'PAID').reduce((sum, inv) => sum + inv.total.toNumber(), 0);

  console.log('═══════════════════════════════════════');
  console.log('✅ ANALYTICS DATA POPULATED!');
  console.log('═══════════════════════════════════════');
  console.log(`Total Invoices: ${allInvoices.length}`);
  console.log(`  - Paid: ${allInvoices.filter(i => i.status === 'PAID').length}`);
  console.log(`  - Sent: ${allInvoices.filter(i => i.status === 'SENT').length}`);
  console.log(`  - Overdue: ${allInvoices.filter(i => i.status === 'OVERDUE').length}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Paid Revenue: $${paidRevenue.toFixed(2)}`);
  console.log('═══════════════════════════════════════\n');
  console.log('🎉 Refresh https://serviceops-ai.vercel.app/analytics');
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
