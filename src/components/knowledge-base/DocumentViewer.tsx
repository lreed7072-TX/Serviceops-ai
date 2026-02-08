"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface DocumentViewerProps {
  fileId: string;
  filename: string;
  mimeType: string;
  title: string;
  onClose: () => void;
}

export default function DocumentViewer({
  fileId,
  filename,
  mimeType,
  title,
  onClose,
}: DocumentViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPdf = mimeType.includes("pdf");
  const isImage = mimeType.startsWith("image/");

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        const res = await apiFetch(
          `/api/files/download?fileId=${encodeURIComponent(fileId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to get download URL");
        const json = await res.json();
        const signedUrl = json?.data?.url as string | undefined;
        if (!signedUrl) throw new Error("Download URL missing");
        setUrl(signedUrl);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchUrl();
  }, [fileId]);

  return (
    <div className="kb-viewer-overlay" onClick={onClose}>
      <div className="kb-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kb-viewer-header">
          <h3>{title || filename}</h3>
          <div className="kb-viewer-actions">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                Open in New Tab
              </a>
            )}
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </div>

        <div className="kb-viewer-content">
          {loading && (
            <div className="kb-viewer-loading">
              <div className="loading-spinner" />
              <p>Loading document...</p>
            </div>
          )}

          {error && (
            <div className="kb-viewer-error">
              <p>{error}</p>
            </div>
          )}

          {url && !loading && !error && (
            <>
              {isPdf && (
                <iframe
                  src={url}
                  title={filename}
                  className="kb-viewer-iframe"
                />
              )}

              {isImage && (
                <img
                  src={url}
                  alt={filename}
                  className="kb-viewer-image"
                />
              )}

              {!isPdf && !isImage && (
                <div className="kb-viewer-unsupported">
                  <span className="kb-viewer-unsupported-icon">📎</span>
                  <p>Preview not available for this file type.</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    Download File
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
