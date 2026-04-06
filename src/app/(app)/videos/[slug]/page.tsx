'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getVideoBySlug } from '@/lib/video-data';
import './video-player.css';

export default function VideoPlayerPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const video = getVideoBySlug(slug);

  /* ---- Not found ---- */
  if (!video) {
    return (
      <div className="video-page">
        <div className="video-not-found">
          <h1>Video Not Found</h1>
          <p>The training video you&rsquo;re looking for doesn&rsquo;t exist.</p>
          <Link href="/help" className="video-not-found-link">
            <ArrowLeft size={16} />
            Back to Help Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="video-page">
      {/* Back link */}
      <Link href="/help" className="video-back">
        <ArrowLeft size={16} />
        Back to Help Center
      </Link>

      {/* Title + summary */}
      <h1 className="video-title">{video.title}</h1>
      <p className="video-summary">{video.summary}</p>

      {/* Video player or pending message */}
      {video.blobUrl ? (
        <div className="video-container">
          <video
            src={video.blobUrl}
            controls
            preload="metadata"
            playsInline
          >
            Your browser does not support the video element.
          </video>
        </div>
      ) : (
        <div className="video-pending">
          This video is being prepared and will be available soon.
        </div>
      )}

      {/* Description from help article content */}
      {video.content.length > 0 && (
        <div className="video-description">
          {video.content.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      )}
    </div>
  );
}
