/**
 * Seed script: Creates a test work order with tasks for mobile app testing.
 * Run: npx tsx prisma/seed-mobile-test.ts
 */

import { PrismaClient, WorkOrderStatus, ExecutionMode, OrderType, WorkPackageType, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the TECH user (Lance's account)
  const techUser = await prisma.user.findFirst({
    where: { role: 'TECH' },
    orderBy: { createdAt: 'asc' },
  });

  if (!techUser) {
    // Try ADMIN as fallback
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      console.error('No users found in database. Please create a user first.');
      process.exit(1);
    }
    console.log(`No TECH found, using ADMIN: ${admin.email} (${admin.id})`);
    Object.assign(techUser!, admin);
  }

  const user = techUser!;
  const orgId = user.orgId;
  console.log(`Using user: ${user.email} (role: ${user.role}, org: ${orgId})`);

  // Find or create a customer
  let customer = await prisma.customer.findFirst({ where: { orgId } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        orgId,
        name: 'City of Westlake Water District',
        primaryEmail: 'ops@westlakewater.gov',
        primaryPhone: '(512) 555-0147',
        billingStreet1: '4200 Bee Cave Rd',
        billingCity: 'Westlake',
        billingState: 'TX',
        billingPostalCode: '78746',
      },
    });
    console.log(`Created customer: ${customer.name}`);
  } else {
    console.log(`Using existing customer: ${customer.name}`);
  }

  // Find or create a site
  let site = await prisma.site.findFirst({ where: { orgId, customerId: customer.id } });
  if (!site) {
    site = await prisma.site.create({
      data: {
        orgId,
        customerId: customer.id,
        name: 'Pump Station #3 - Lake Austin',
        address: '2800 Lake Austin Blvd',
        city: 'Austin',
        state: 'TX',
        postalCode: '78703',
      },
    });
    console.log(`Created site: ${site.name}`);
  } else {
    console.log(`Using existing site: ${site.name}`);
  }

  // Find or create an asset
  let asset = await prisma.asset.findFirst({ where: { orgId, siteId: site.id } });
  if (!asset) {
    asset = await prisma.asset.create({
      data: {
        orgId,
        customerId: customer.id,
        siteId: site.id,
        name: 'Vertical Turbine Pump VTP-301',
        manufacturer: 'Flowserve',
        model: 'VTP 12x14-3',
        serialNumber: 'FS-2019-VTP-44821',
        assetCategory: 'ROTATING_EQUIPMENT',
        assetFamily: 'PUMP',
        assetSubFamily: 'VERTICAL_TURBINE',
        criticality: 'HIGH',
        location: 'Wet Well B, Bay 3',
      },
    });
    console.log(`Created asset: ${asset.name}`);
  } else {
    console.log(`Using existing asset: ${asset.name}`);
  }

  // Generate WO number
  const lastWO = await prisma.workOrder.findFirst({
    where: { orgId, orderType: 'WORK_ORDER', workOrderNumber: { startsWith: 'WO' } },
    select: { workOrderNumber: true },
    orderBy: { createdAt: 'desc' },
  });
  const lastNum = lastWO?.workOrderNumber ? parseInt(lastWO.workOrderNumber.replace('WO', ''), 10) : 0;
  const woNumber = `WO${String(lastNum + 1).padStart(5, '0')}`;

  // Create the work order
  const workOrder = await prisma.workOrder.create({
    data: {
      orgId,
      customerId: customer.id,
      siteId: site.id,
      assetId: asset.id,
      title: 'Annual Pump Inspection & Performance Test - VTP-301',
      description: 'Perform annual inspection of Vertical Turbine Pump VTP-301. Document before/after condition, take nameplate photos, record vibration and flow measurements, and complete field report with findings.',
      status: WorkOrderStatus.IN_PROGRESS,
      executionMode: ExecutionMode.UNIFIED,
      orderType: OrderType.WORK_ORDER,
      workOrderNumber: woNumber,
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      estimatedHours: 6,
      createdByUserId: user.id,
    },
  });
  console.log(`\nCreated Work Order: ${woNumber} - ${workOrder.title}`);

  // Create work package
  const pkg = await prisma.workPackage.create({
    data: {
      orgId,
      workOrderId: workOrder.id,
      packageType: WorkPackageType.MECH_ELEC_UNIFIED,
      name: 'Mech/Electrical Unified',
      leadTechId: user.id,
    },
  });

  // Create tasks
  const tasks = [
    {
      title: 'Site Arrival & Safety Walkthrough',
      description: 'Check in at site, perform safety walkthrough. Take BEFORE photos of pump station area, document any safety hazards.',
      sequenceNumber: 1,
      isCritical: true,
      requiresEvidence: true,
      status: TaskStatus.TODO,
    },
    {
      title: 'Equipment Nameplate Documentation',
      description: 'Photograph all nameplates on pump, motor, and control panel. Record model numbers, serial numbers, and ratings. Take clear photos of each nameplate.',
      sequenceNumber: 2,
      isCritical: true,
      requiresEvidence: true,
      status: TaskStatus.TODO,
    },
    {
      title: 'Vibration Measurements',
      description: 'Record vibration readings at pump bearing housing (DE and NDE), motor bearing housing (DE and NDE). Use CSI analyzer. Record readings in mils (peak-to-peak).\n\nSpec: Pump DE < 2.0 mils, Pump NDE < 2.0 mils, Motor DE < 1.5 mils, Motor NDE < 1.5 mils',
      sequenceNumber: 3,
      isCritical: false,
      requiresEvidence: true,
      status: TaskStatus.TODO,
    },
    {
      title: 'Flow & Pressure Test',
      description: 'Record suction pressure, discharge pressure, and flow rate at 3 operating points (50%, 75%, 100% speed). Compare to pump curve.\n\nDesign point: 1200 GPM @ 85 ft TDH',
      sequenceNumber: 4,
      isCritical: false,
      requiresEvidence: true,
      status: TaskStatus.TODO,
    },
    {
      title: 'Photo Documentation - Condition Assessment',
      description: 'Take detailed photos documenting current condition:\n- Pump discharge piping and connections\n- Motor cooling fins and frame\n- Any signs of corrosion, leaks, or damage\n- Electrical connections at junction box\n- Foundation bolts and baseplate condition',
      sequenceNumber: 5,
      isCritical: true,
      requiresEvidence: true,
      status: TaskStatus.TODO,
    },
    {
      title: 'Complete Field Report & After Photos',
      description: 'Write summary of findings, note any recommended repairs or follow-up work. Take AFTER photos showing equipment in final state. Get customer signature if available.',
      sequenceNumber: 6,
      isCritical: true,
      requiresEvidence: true,
      status: TaskStatus.TODO,
    },
  ];

  for (const task of tasks) {
    const created = await prisma.taskInstance.create({
      data: {
        orgId,
        workOrderId: workOrder.id,
        workPackageId: pkg.id,
        assignedToId: user.id,
        ...task,
      },
    });
    console.log(`  Task ${task.sequenceNumber}: ${task.title} [${task.status}]`);
  }

  // Create a visit for this work order
  const visit = await prisma.visit.create({
    data: {
      orgId,
      workOrderId: workOrder.id,
      assignedTechId: user.id,
      status: 'IN_PROGRESS',
      visitNumber: `${woNumber}-V1`,
      scheduledFor: new Date(),
      startedAt: new Date(),
    },
  });
  console.log(`  Visit: ${visit.visitNumber}`);

  console.log(`\n========================================`);
  console.log(`  TEST WORK ORDER READY!`);
  console.log(`  WO#: ${woNumber}`);
  console.log(`  Customer: ${customer.name}`);
  console.log(`  Site: ${site.name}`);
  console.log(`  Asset: ${asset.name}`);
  console.log(`  Tasks: ${tasks.length} (all assigned to ${user.email})`);
  console.log(`  Status: IN_PROGRESS`);
  console.log(`  Priority: HIGH`);
  console.log(`========================================\n`);
  console.log(`Open the mobile app and pull-to-refresh to see this work order.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
