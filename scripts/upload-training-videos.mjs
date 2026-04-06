#!/usr/bin/env node
// =============================================================================
// Upload Training Videos to Vercel Blob Storage
// Usage: node scripts/upload-training-videos.mjs
//
// Prerequisites:
//   1. npm install @vercel/blob
//   2. Set BLOB_READ_WRITE_TOKEN in .env.local (from Vercel Dashboard → Storage)
//   3. Training videos at ../serviceops-training-videos/projects/{dir}/out/product-demo.mp4
// =============================================================================

import { put } from '@vercel/blob';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local (Next.js convention) from project root
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

// Project root and video source root
const PROJECT_ROOT = resolve(__dirname, '..');
const VIDEOS_ROOT = resolve(PROJECT_ROOT, '..', 'serviceops-training-videos', 'projects');
const VIDEO_DATA_PATH = resolve(PROJECT_ROOT, 'src', 'lib', 'video-data.ts');

// Slug → directory name (only where they differ)
const SLUG_TO_DIR = {
  '02-organization-setup': '02-org-setup',
  '13-quickbooks-connect': '13-connecting-quickbooks',
};

// All 23 video slugs
const SLUGS = [
  '01-getting-started',
  '02-organization-setup',
  '03-dashboard-search',
  '04-customer-management',
  '05-sites-access-notes',
  '06-asset-management',
  '07-procedures-standards',
  '08-work-order-lifecycle',
  '09-visit-execution',
  '10-quoting-approvals',
  '11-invoicing-payments',
  '12-pdf-generation',
  '13-quickbooks-connect',
  '14-qbo-sync',
  '15-ai-insights',
  '16-ai-copilot',
  '17-crm-overview',
  '18-sales-reports',
  '19-pm-schedules',
  '20-materials-inventory',
  '21-custom-reports',
  '22-portals',
  '23-reports-analytics',
];

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('ERROR: BLOB_READ_WRITE_TOKEN not set. Add it to .env.local');
    process.exit(1);
  }

  const results = {};
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const slug of SLUGS) {
    const dir = SLUG_TO_DIR[slug] || slug;
    const mp4Path = resolve(VIDEOS_ROOT, dir, 'out', 'product-demo.mp4');

    if (!existsSync(mp4Path)) {
      console.warn(`SKIP: ${slug} — file not found: ${mp4Path}`);
      results[slug] = '';
      skipped++;
      continue;
    }

    const fileBuffer = readFileSync(mp4Path);
    const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(1);
    console.log(`Uploading ${slug} (${sizeMB} MB)...`);

    try {
      const blob = await put(`training-videos/${slug}.mp4`, fileBuffer, {
        access: 'public',
        contentType: 'video/mp4',
      });
      results[slug] = blob.url;
      uploaded++;
      console.log(`  OK: ${blob.url}`);
    } catch (err) {
      console.error(`  FAIL: ${slug} — ${err.message}`);
      results[slug] = '';
      errors++;
    }
  }

  // Write blob URLs back into video-data.ts
  let source = readFileSync(VIDEO_DATA_PATH, 'utf-8');

  for (const [slug, url] of Object.entries(results)) {
    if (!url) continue;
    // Replace the empty string for this slug with the real URL
    const pattern = new RegExp(`'${slug}':\\s*'[^']*'`);
    source = source.replace(pattern, `'${slug}': '${url}'`);
  }

  writeFileSync(VIDEO_DATA_PATH, source, 'utf-8');

  console.log('\n--- Summary ---');
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Errors:   ${errors}`);
  console.log(`\nBlob URLs written to src/lib/video-data.ts`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
