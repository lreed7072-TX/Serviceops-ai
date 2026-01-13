/**
 * Seed common procedure templates
 * Run with: npx tsx scripts/seed-procedures.ts
 */

import { PrismaClient, ProcedureContext } from "@prisma/client";

const prisma = new PrismaClient();

type ProcedureTemplate = {
  name: string;
  description: string;
  assetCategory: string;
  assetFamily?: string;
  context: ProcedureContext;
  estimatedDurationMinutes: number;
  steps: Array<{
    title: string;
    description?: string;
    domain?: string;
    isCritical: boolean;
    requiresEvidence: boolean;
    estimatedMinutes: number;
  }>;
};

const COMMON_PROCEDURES: ProcedureTemplate[] = [
  // 1. Submersible Pump Seal Replacement
  {
    name: "Submersible Pump Mechanical Seal Replacement",
    description: "Complete procedure for replacing mechanical seals on submersible wastewater pumps",
    assetCategory: "PUMP",
    assetFamily: "SUBMERSIBLE_WASTEWATER",
    context: "REPAIR",
    estimatedDurationMinutes: 240,
    steps: [
      {
        title: "Lockout/Tagout electrical feed to pump",
        description: "Verify zero energy state, lock out disconnect, test for voltage",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 15,
      },
      {
        title: "Disconnect power cables at motor termination box",
        description: "Remove junction box cover, disconnect L1, L2, L3 and ground",
        domain: "ELECTRICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 20,
      },
      {
        title: "Disconnect guide rail system",
        description: "Remove lifting chain connection, secure guide rails",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 15,
      },
      {
        title: "Lift pump from wet well using hoist",
        description: "Attach lifting equipment, slowly extract pump, place on laydown area",
        domain: "MECHANICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 45,
      },
      {
        title: "Drain pump casing and inspect impeller",
        description: "Remove drain plugs, check impeller for damage, remove debris",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 20,
      },
      {
        title: "Remove motor housing bolts and separate motor from volute",
        description: "Remove housing bolts in star pattern, carefully separate components",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 30,
      },
      {
        title: "Remove old mechanical seal components",
        description: "Extract seal faces, O-rings, and spring assemblies, clean seal cavity",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 25,
      },
      {
        title: "Install new mechanical seal per manufacturer specs",
        description: "Lubricate with clean water, install seal faces, verify spring compression",
        domain: "MECHANICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 40,
      },
      {
        title: "Reassemble motor housing to volute",
        description: "Torque bolts to spec in star pattern, verify alignment",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 30,
      },
      {
        title: "Lower pump back into wet well",
        description: "Reconnect guide rail system, secure lifting chain",
        domain: "MECHANICAL",
        isCritical: true,
        requiresEvidence: false,
        estimatedMinutes: 45,
      },
      {
        title: "Reconnect power cables",
        description: "Connect L1, L2, L3 and ground per wiring diagram",
        domain: "ELECTRICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 20,
      },
      {
        title: "Verify rotation direction",
        description: "Bump motor, confirm CCW rotation (looking at shaft end)",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 10,
      },
      {
        title: "Perform running test and leak check",
        description: "Run pump for 30 minutes, verify no leaks at seal, check current draw",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 35,
      },
      {
        title: "Remove LOTO and restore to service",
        description: "Remove locks/tags, notify operations, update maintenance log",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: false,
        estimatedMinutes: 10,
      },
    ],
  },

  // 2. VFD Replacement - Control Panel
  {
    name: "VFD Replacement - Control Panel Installation",
    description: "Complete replacement of Variable Frequency Drive in control panel",
    assetCategory: "VFD",
    context: "REPAIR",
    estimatedDurationMinutes: 180,
    steps: [
      {
        title: "Lockout/Tagout main panel disconnect",
        description: "Verify zero energy, lock out main breaker, test for voltage",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 15,
      },
      {
        title: "Document existing VFD wiring",
        description: "Photograph all connections, label wires, record parameter settings",
        domain: "CONTROLS",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 20,
      },
      {
        title: "Disconnect VFD input power",
        description: "Remove L1, L2, L3 connections from line side",
        domain: "ELECTRICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 10,
      },
      {
        title: "Disconnect VFD output to motor",
        description: "Remove T1, T2, T3 connections to motor",
        domain: "ELECTRICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 10,
      },
      {
        title: "Disconnect control wiring",
        description: "Remove 24V control power, analog inputs, digital I/O, comm cables",
        domain: "CONTROLS",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 25,
      },
      {
        title: "Remove failed VFD from panel",
        description: "Remove mounting screws, extract unit, inspect panel for damage",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 15,
      },
      {
        title: "Install new VFD in panel",
        description: "Mount new drive, verify clearances per code",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 20,
      },
      {
        title: "Reconnect input power",
        description: "Connect L1, L2, L3, verify voltage rating matches supply",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: false,
        estimatedMinutes: 15,
      },
      {
        title: "Reconnect output to motor",
        description: "Connect T1, T2, T3 to motor terminals",
        domain: "ELECTRICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 15,
      },
      {
        title: "Reconnect control wiring per diagram",
        description: "Wire 24V power, analog signals, digital I/O, communications",
        domain: "CONTROLS",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 30,
      },
      {
        title: "Program VFD parameters",
        description: "Enter motor nameplate data, accel/decel times, PID settings",
        domain: "CONTROLS",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 35,
      },
      {
        title: "Perform no-load test",
        description: "Remove LOTO, energize drive, verify display, test all I/O",
        domain: "CONTROLS",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 20,
      },
      {
        title: "Perform loaded run test",
        description: "Start motor, verify rotation, ramp to full speed, monitor current",
        domain: "CONTROLS",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 25,
      },
    ],
  },

  // 3. Motor Startup Procedure
  {
    name: "3-Phase AC Motor Startup Procedure",
    description: "Standard startup checklist for new or rebuilt electric motors",
    assetCategory: "MOTOR",
    context: "STARTUP",
    estimatedDurationMinutes: 120,
    steps: [
      {
        title: "Verify motor installation and alignment",
        description: "Check mounting bolts, coupling alignment, base grouting",
        domain: "MECHANICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 20,
      },
      {
        title: "Perform insulation resistance (megger) test",
        description: "Test phase-to-phase and phase-to-ground, minimum 1 MΩ required",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 15,
      },
      {
        title: "Verify power supply voltage and phase balance",
        description: "Measure L1-L2, L2-L3, L3-L1, verify within ±5% of nameplate",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 10,
      },
      {
        title: "Check motor rotation direction (uncoupled)",
        description: "Bump motor briefly, verify rotation matches required direction",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 10,
      },
      {
        title: "Verify bearing lubrication",
        description: "Check grease level, type matches nameplate, purge if needed",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 15,
      },
      {
        title: "Couple motor to driven equipment",
        description: "Install coupling, verify alignment, torque fasteners to spec",
        domain: "MECHANICAL",
        isCritical: true,
        requiresEvidence: false,
        estimatedMinutes: 25,
      },
      {
        title: "Start motor and monitor initial operation",
        description: "Start motor, listen for abnormal noise, check vibration, monitor current",
        domain: "ELECTRICAL",
        isCritical: true,
        requiresEvidence: true,
        estimatedMinutes: 20,
      },
      {
        title: "Record baseline measurements",
        description: "Document voltage, current (L1, L2, L3), vibration, temperature",
        domain: "INSTRUMENTATION",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 15,
      },
    ],
  },

  // 4. Centrifugal Pump PM
  {
    name: "Centrifugal Pump Preventive Maintenance",
    description: "Quarterly PM inspection for horizontal split-case pumps",
    assetCategory: "PUMP",
    assetFamily: "CENTRIFUGAL_HORIZONTAL",
    context: "PM",
    estimatedDurationMinutes: 90,
    steps: [
      {
        title: "Review pump operating data",
        description: "Check run hours, flow rate, discharge pressure, motor current",
        domain: "INSTRUMENTATION",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 10,
      },
      {
        title: "Inspect for leaks and corrosion",
        description: "Check mechanical seal, packing gland, casing for weeps/corrosion",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 15,
      },
      {
        title: "Check pump alignment",
        description: "Verify coupling alignment with dial indicator, adjust if needed",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 20,
      },
      {
        title: "Inspect coupling condition",
        description: "Check for wear, cracks, missing components, lubricate if required",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: 10,
      },
      {
        title: "Check bearing condition and lubrication",
        description: "Listen for noise, check temperature, verify grease level",
        domain: "MECHANICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 15,
      },
      {
        title: "Measure vibration levels",
        description: "Record vibration at bearing housings, compare to baseline",
        domain: "INSTRUMENTATION",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 10,
      },
      {
        title: "Verify motor performance",
        description: "Measure voltage, current (3-phase), verify within nameplate ratings",
        domain: "ELECTRICAL",
        isCritical: false,
        requiresEvidence: true,
        estimatedMinutes: 10,
      },
    ],
  },
];

async function seedProcedures(orgId: string, userId: string) {
  console.log(`\n🌱 Seeding ${COMMON_PROCEDURES.length} procedure templates...\n`);

  for (const proc of COMMON_PROCEDURES) {
    try {
      // Check if template already exists
      const existing = await prisma.procedureTemplate.findFirst({
        where: {
          orgId,
          name: proc.name,
        },
      });

      if (existing) {
        console.log(`⏭️  Skipping "${proc.name}" (already exists)`);
        continue;
      }

      // Create template
      const template = await prisma.procedureTemplate.create({
        data: {
          name: proc.name,
          description: proc.description,
          context: proc.context,
          estimatedDuration: proc.estimatedDurationMinutes,
          version: 1,
          status: "ACTIVE",
          org: { connect: { id: orgId } },
          createdBy: { connect: { id: userId } },
        },
      });

      // Create steps
      for (let i = 0; i < proc.steps.length; i++) {
        const step = proc.steps[i];
        await prisma.procedureStepTemplate.create({
          data: {
            title: step.title,
            description: step.description || null,
            domain: step.domain || null,
            isCritical: step.isCritical,
            requiresEvidence: step.requiresEvidence,
            estimatedMinutes: step.estimatedMinutes,
            sequenceNumber: i + 1,
            org: { connect: { id: orgId } },
            procedureTemplate: { connect: { id: template.id } },
          },
        });
      }

      console.log(`✅ Created "${proc.name}" with ${proc.steps.length} steps`);
    } catch (error) {
      console.error(`❌ Failed to create "${proc.name}":`, error);
    }
  }

  console.log(`\n✨ Seeding complete!\n`);
}

// Main execution
async function main() {
  // Get orgId and userId from command line arguments
  const orgId = process.argv[2];
  const userId = process.argv[3];

  if (!orgId || !userId) {
    console.error("Usage: npx tsx scripts/seed-procedures.ts <orgId> <userId>");
    console.error("\nExample: npx tsx scripts/seed-procedures.ts org_123 user_456");
    console.error("\nTo find your orgId and userId, check your database or run:");
    console.error("  SELECT id, name FROM \"Org\" LIMIT 1;");
    console.error("  SELECT id, email FROM \"User\" WHERE role = 'ADMIN' LIMIT 1;");
    process.exit(1);
  }

  console.log(`\nSeeding procedures for org: ${orgId}`);
  console.log(`Created by user: ${userId}\n`);

  await seedProcedures(orgId, userId);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
