/**
 * CLEANUP SCRIPT: Remove Duplicate Sites
 * 
 * Problem: Same sites created multiple times with different IDs
 * Solution: Keep oldest site for each name+customer combo, delete rest
 * 
 * Run: npx tsx scripts/cleanup-duplicate-sites.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupDuplicateSites() {
  console.log("🔍 Finding duplicate sites...\n");

  // Get all sites
  const allSites = await prisma.site.findMany({
    orderBy: { createdAt: "asc" }, // Oldest first
  });

  console.log(`📊 Total sites in database: ${allSites.length}\n`);

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
    .filter(([_, sites]) => sites.length > 1);

  console.log(`🔄 Found ${duplicateGroups.length} groups with duplicates\n`);

  if (duplicateGroups.length === 0) {
    console.log("✅ No duplicates found!");
    return;
  }

  // Show sample duplicates
  console.log("📋 Sample duplicate groups:");
  duplicateGroups.slice(0, 5).forEach(([key, sites]) => {
    const [customerId, name] = key.split(":");
    console.log(`  - "${name}" (${sites.length} copies)`);
  });
  console.log("");

  // Calculate what will be deleted
  let totalToDelete = 0;
  const sitesToDelete: string[] = [];

  duplicateGroups.forEach(([key, sites]) => {
    // Keep the first (oldest), delete the rest
    const [keepSite, ...deleteSites] = sites;
    totalToDelete += deleteSites.length;
    deleteSites.forEach(s => sitesToDelete.push(s.id));
  });

  console.log(`🗑️  Will keep ${siteGroups.size} unique sites`);
  console.log(`🗑️  Will delete ${totalToDelete} duplicate sites\n`);

  // Ask for confirmation
  console.log("⚠️  THIS WILL PERMANENTLY DELETE DATA!");
  console.log("   Press Ctrl+C to cancel\n");

  // Check for related data
  console.log("🔍 Checking for related data on sites to be deleted...");
  
  const sitesWithWorkOrders = await prisma.site.findMany({
    where: {
      id: { in: sitesToDelete },
      workOrders: { some: {} },
    },
    select: { id: true, name: true },
  });

  if (sitesWithWorkOrders.length > 0) {
    console.log(`\n❌ ERROR: ${sitesWithWorkOrders.length} duplicate sites have work orders!`);
    console.log("   Cannot safely delete. Manual review needed.\n");
    sitesWithWorkOrders.slice(0, 10).forEach(s => {
      console.log(`   - ${s.name} (${s.id})`);
    });
    console.log("\n   Suggestion: Migrate work orders to kept site first.");
    process.exit(1);
  }

  console.log("✅ No work orders found on duplicate sites\n");

  // Perform deletion
  console.log("🧹 Starting cleanup...\n");

  const result = await prisma.site.deleteMany({
    where: {
      id: { in: sitesToDelete },
    },
  });

  console.log(`✅ Deleted ${result.count} duplicate sites`);
  console.log(`✅ Kept ${siteGroups.size} unique sites\n`);

  // Verify
  const remainingSites = await prisma.site.findMany();
  console.log(`📊 Final site count: ${remainingSites.length}\n`);

  // Show what was kept
  const uniqueSiteNames = new Set(remainingSites.map(s => s.name));
  console.log(`✨ Unique site names remaining: ${uniqueSiteNames.size}`);
  console.log("\nSample sites kept:");
  remainingSites.slice(0, 10).forEach(s => {
    console.log(`  - ${s.name} (created ${s.createdAt.toISOString()})`);
  });
}

async function main() {
  try {
    await cleanupDuplicateSites();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
