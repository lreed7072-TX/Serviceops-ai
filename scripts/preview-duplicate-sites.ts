/**
 * PREVIEW ONLY: Show what would be deleted (doesn't delete anything)
 * 
 * Run: npx tsx scripts/preview-duplicate-sites.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function previewDuplicates() {
  console.log("🔍 Analyzing duplicate sites (PREVIEW ONLY - NO CHANGES)\n");

  const allSites = await prisma.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      customer: { select: { name: true } },
      workOrders: { select: { id: true } },
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
    .sort((a, b) => b[1].length - a[1].length); // Most duplicates first

  console.log(`🔄 Found ${duplicateGroups.length} groups with duplicates\n`);

  if (duplicateGroups.length === 0) {
    console.log("✅ No duplicates found!");
    return;
  }

  // Show top 20 duplicate groups
  console.log("📋 Top duplicate groups:\n");
  duplicateGroups.slice(0, 20).forEach(([key, sites], index) => {
    const [_, name] = key.split(":");
    const customer = sites[0].customer.name;
    const workOrderCount = sites.reduce((sum, s) => sum + s.workOrders.length, 0);
    
    console.log(`${index + 1}. "${name}"`);
    console.log(`   Customer: ${customer}`);
    console.log(`   Copies: ${sites.length}`);
    console.log(`   Work Orders: ${workOrderCount}`);
    console.log(`   Keep: ${sites[0].createdAt.toISOString()}`);
    console.log(`   Delete: ${sites.length - 1} newer copies\n`);
  });

  // Summary
  let totalToDelete = 0;
  let sitesWithWorkOrders = 0;

  duplicateGroups.forEach(([_, sites]) => {
    totalToDelete += sites.length - 1;
    sites.slice(1).forEach(site => {
      if (site.workOrders.length > 0) sitesWithWorkOrders++;
    });
  });

  console.log("📊 SUMMARY:");
  console.log(`   Total sites: ${allSites.length}`);
  console.log(`   Unique sites: ${siteGroups.size}`);
  console.log(`   Will keep: ${siteGroups.size}`);
  console.log(`   Will delete: ${totalToDelete}`);
  console.log(`   ⚠️  Duplicates with work orders: ${sitesWithWorkOrders}\n`);

  if (sitesWithWorkOrders > 0) {
    console.log("⚠️  WARNING: Some duplicate sites have work orders!");
    console.log("   These need manual review before deletion.\n");
  }

  console.log("💡 To actually delete duplicates, run:");
  console.log("   npx tsx scripts/cleanup-duplicate-sites.ts\n");
}

async function main() {
  try {
    await previewDuplicates();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
