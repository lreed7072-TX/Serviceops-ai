/**
 * MIGRATION SCRIPT: Consolidate Duplicate Sites
 * 
 * Problem: Duplicate sites with work orders attached
 * Solution: Migrate work orders to primary site, then delete duplicates
 * 
 * Strategy:
 * 1. Group sites by customer + name
 * 2. Pick primary site (most work orders, or oldest)
 * 3. Migrate all work orders from duplicates to primary
 * 4. Delete empty duplicate sites
 * 
 * Run: npx tsx scripts/migrate-and-cleanup-sites.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateAndCleanup(dryRun: boolean = true) {
  const mode = dryRun ? "DRY RUN (NO CHANGES)" : "LIVE MODE (WILL MODIFY DATA)";
  console.log(`🔄 Consolidating duplicate sites - ${mode}\n`);

  // Get all sites with work order counts
  const allSites = await prisma.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      customer: { select: { name: true } },
      workOrders: { select: { id: true, workOrderNumber: true } },
    },
  });

  console.log(`📊 Total sites: ${allSites.length}\n`);

  // Group by customer + name
  const siteGroups = new Map<string, typeof allSites>();
  
  allSites.forEach((site) => {
    const key = `${site.customerId}:${site.name}`;
    if (!siteGroups.has(key)) {
      siteGroups.set(key, []);
    }
    siteGroups.get(key)!.push(site);
  });

  // Find duplicates
  const duplicateGroups = Array.from(siteGroups.entries())
    .filter(([_, sites]) => sites.length > 1)
    .sort((a, b) => {
      const aWorkOrders = a[1].reduce((sum, s) => sum + s.workOrders.length, 0);
      const bWorkOrders = b[1].reduce((sum, s) => sum + s.workOrders.length, 0);
      return bWorkOrders - aWorkOrders; // Most work orders first
    });

  console.log(`🔄 Found ${duplicateGroups.length} groups with duplicates\n`);

  if (duplicateGroups.length === 0) {
    console.log("✅ No duplicates found!");
    return;
  }

  let totalWorkOrdersMigrated = 0;
  let totalSitesDeleted = 0;
  const migrations: Array<{
    group: string;
    primary: string;
    duplicates: Array<{ id: string; workOrderCount: number }>;
    workOrdersToMigrate: number;
  }> = [];

  // Plan migrations
  for (const [key, sites] of duplicateGroups) {
    const [customerId, name] = key.split(":");
    
    // Pick primary site (most work orders, or oldest if tie)
    const sorted = [...sites].sort((a, b) => {
      const countDiff = b.workOrders.length - a.workOrders.length;
      if (countDiff !== 0) return countDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const primary = sorted[0];
    const duplicates = sorted.slice(1);
    
    const workOrdersToMigrate = duplicates.reduce((sum, s) => sum + s.workOrders.length, 0);
    
    migrations.push({
      group: `${sites[0].customer.name} - ${name}`,
      primary: primary.id,
      duplicates: duplicates.map(d => ({
        id: d.id,
        workOrderCount: d.workOrders.length,
      })),
      workOrdersToMigrate,
    });

    totalWorkOrdersMigrated += workOrdersToMigrate;
    totalSitesDeleted += duplicates.length;
  }

  // Show migration plan
  console.log("📋 MIGRATION PLAN:\n");
  migrations.slice(0, 10).forEach((m, i) => {
    console.log(`${i + 1}. ${m.group}`);
    console.log(`   Primary: ${m.primary} (${m.duplicates.reduce((s, d) => s + d.workOrderCount, 0)} + work orders on primary)`);
    console.log(`   Duplicates to delete: ${m.duplicates.length}`);
    console.log(`   Work orders to migrate: ${m.workOrdersToMigrate}`);
    m.duplicates.forEach(d => {
      if (d.workOrderCount > 0) {
        console.log(`     - ${d.id} (${d.workOrderCount} work orders)`);
      }
    });
    console.log();
  });

  console.log("📊 SUMMARY:");
  console.log(`   Groups to consolidate: ${migrations.length}`);
  console.log(`   Sites to delete: ${totalSitesDeleted}`);
  console.log(`   Work orders to migrate: ${totalWorkOrdersMigrated}`);
  console.log(`   Sites to keep: ${siteGroups.size}\n`);

  if (dryRun) {
    console.log("🔍 DRY RUN - No changes made");
    console.log("💡 To execute, run with --execute flag:\n");
    console.log("   npx tsx scripts/migrate-and-cleanup-sites.ts --execute\n");
    return;
  }

  // Execute migrations
  console.log("⚠️  EXECUTING MIGRATIONS - THIS WILL MODIFY DATA!\n");
  console.log("Press Ctrl+C within 5 seconds to cancel...");
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("\n🚀 Starting migrations...\n");

  for (const migration of migrations) {
    console.log(`Processing: ${migration.group}`);
    
    for (const duplicate of migration.duplicates) {
      if (duplicate.workOrderCount > 0) {
        // Migrate work orders
        const result = await prisma.workOrder.updateMany({
          where: { siteId: duplicate.id },
          data: { siteId: migration.primary },
        });
        
        console.log(`  ✓ Migrated ${result.count} work orders from ${duplicate.id} to ${migration.primary}`);
      }
    }

    // Delete empty duplicates
    const deletedSites = await prisma.site.deleteMany({
      where: {
        id: { in: migration.duplicates.map(d => d.id) },
      },
    });

    console.log(`  ✓ Deleted ${deletedSites.count} duplicate sites\n`);
  }

  console.log("✅ Migration complete!\n");

  // Verify
  const remainingSites = await prisma.site.findMany();
  console.log(`📊 Final site count: ${remainingSites.length}`);
  console.log(`   Expected: ${siteGroups.size}`);
  
  if (remainingSites.length !== siteGroups.size) {
    console.log("⚠️  Warning: Final count doesn't match expected!");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");

  try {
    await migrateAndCleanup(!execute);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
