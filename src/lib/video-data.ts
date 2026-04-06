// =============================================================================
// Training Video Blob URLs
// Populated by scripts/upload-training-videos.mjs after Vercel Blob upload
// =============================================================================

import { TRAINING_VIDEO_ARTICLES } from './help-data';

/**
 * Slug → Vercel Blob URL mapping.
 * After running the upload script, these values are replaced with real blob URLs.
 * A value of '' means the video has not been uploaded yet.
 */
export const VIDEO_BLOB_URLS: Record<string, string> = {
  '01-getting-started': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/01-getting-started.mp4',
  '02-organization-setup': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/02-organization-setup.mp4',
  '03-dashboard-search': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/03-dashboard-search.mp4',
  '04-customer-management': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/04-customer-management.mp4',
  '05-sites-access-notes': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/05-sites-access-notes.mp4',
  '06-asset-management': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/06-asset-management.mp4',
  '07-procedures-standards': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/07-procedures-standards.mp4',
  '08-work-order-lifecycle': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/08-work-order-lifecycle.mp4',
  '09-visit-execution': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/09-visit-execution.mp4',
  '10-quoting-approvals': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/10-quoting-approvals.mp4',
  '11-invoicing-payments': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/11-invoicing-payments.mp4',
  '12-pdf-generation': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/12-pdf-generation.mp4',
  '13-quickbooks-connect': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/13-quickbooks-connect.mp4',
  '14-qbo-sync': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/14-qbo-sync.mp4',
  '15-ai-insights': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/15-ai-insights.mp4',
  '16-ai-copilot': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/16-ai-copilot.mp4',
  '17-crm-overview': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/17-crm-overview.mp4',
  '18-sales-reports': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/18-sales-reports.mp4',
  '19-pm-schedules': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/19-pm-schedules.mp4',
  '20-materials-inventory': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/20-materials-inventory.mp4',
  '21-custom-reports': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/21-custom-reports.mp4',
  '22-portals': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/22-portals.mp4',
  '23-reports-analytics': 'https://afyymxw8nuqlu1pl.public.blob.vercel-storage.com/training-videos/23-reports-analytics.mp4',
};

/**
 * Slug → directory name mapping for cases where the help-data slug
 * doesn't match the filesystem directory name.
 */
export const SLUG_TO_DIR: Record<string, string> = {
  '02-organization-setup': '02-org-setup',
  '13-quickbooks-connect': '13-connecting-quickbooks',
};

export interface VideoData {
  slug: string;
  blobUrl: string;
  title: string;
  summary: string;
  content: string[];
}

/**
 * Look up a video by its URL slug (e.g. "01-getting-started").
 * Returns null if the slug doesn't match any training video article.
 */
export function getVideoBySlug(slug: string): VideoData | null {
  const article = TRAINING_VIDEO_ARTICLES.find(
    (a) => a.videoUrl === `/videos/${slug}`
  );
  if (!article) return null;

  const blobUrl = VIDEO_BLOB_URLS[slug] || '';

  return {
    slug,
    blobUrl,
    title: article.title,
    summary: article.summary,
    content: article.content || [],
  };
}

/** All valid video slugs */
export const ALL_VIDEO_SLUGS = Object.keys(VIDEO_BLOB_URLS);
