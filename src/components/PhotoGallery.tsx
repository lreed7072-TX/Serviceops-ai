"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const PHOTO_TYPE_LABELS: Record<string, string> = {
  BEFORE_WORK: "Before Work",
  AFTER_WORK: "After Work",
  NAMEPLATE: "Nameplate",
  DAMAGE: "Damage",
  SAFETY_HAZARD: "Safety Hazard",
  MEASUREMENT: "Measurement",
  PARTS: "Parts",
  INSTALLATION: "Installation",
  WIRING: "Wiring",
  CORROSION: "Corrosion",
  LEAK: "Leak",
  ALIGNMENT: "Alignment",
  GENERAL: "General",
};

type PhotoData = {
  id: string;
  photoType: string;
  fileId: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  isCustomerVisible: boolean;
  uploadedBy: { name: string | null; email: string };
  createdAt: string;
  url: string | null;
};

type Props = {
  workOrderId: string;
  refreshTrigger: number;
};

export function PhotoGallery({ workOrderId, refreshTrigger }: Props) {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/work-orders/${workOrderId}/photos`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setPhotos(json.data ?? []);
      }
    } catch (e) {
      console.error("Failed to load photos:", e);
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos, refreshTrigger]);

  const filteredPhotos = filter === "ALL" ? photos : photos.filter((p) => p.photoType === filter);

  // Get unique photo types present in the gallery
  const typesPresent = Array.from(new Set(photos.map((p) => p.photoType)));

  if (loading) return <p className="muted">Loading photos...</p>;
  if (photos.length === 0) return <p className="muted">No photos yet. Use the controls above to capture photos.</p>;

  return (
    <div className="pg-container">
      {/* Filter bar */}
      <div className="pg-filters">
        <button
          className={`pg-filter-btn ${filter === "ALL" ? "active" : ""}`}
          onClick={() => setFilter("ALL")}
        >
          All ({photos.length})
        </button>
        {typesPresent.map((type) => {
          const count = photos.filter((p) => p.photoType === type).length;
          return (
            <button
              key={type}
              className={`pg-filter-btn ${filter === type ? "active" : ""}`}
              onClick={() => setFilter(type)}
            >
              {PHOTO_TYPE_LABELS[type] ?? type} ({count})
            </button>
          );
        })}
      </div>

      {/* Photo grid */}
      <div className="pg-grid">
        {filteredPhotos.map((photo) => (
          <div
            key={photo.id}
            className="pg-card"
            onClick={() => setSelectedPhoto(photo)}
          >
            {photo.url ? (
              <img
                src={photo.url}
                alt={photo.caption || PHOTO_TYPE_LABELS[photo.photoType] || "Photo"}
                className="pg-thumb"
                loading="lazy"
              />
            ) : (
              <div className="pg-thumb-placeholder">No preview</div>
            )}
            <div className="pg-card-info">
              <span className="pg-type-badge">{PHOTO_TYPE_LABELS[photo.photoType] ?? photo.photoType}</span>
              {photo.caption && <span className="pg-caption">{photo.caption}</span>}
              {photo.isCustomerVisible && <span className="pg-visible-badge">Customer</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Full-screen viewer */}
      {selectedPhoto && (
        <div className="pg-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="pg-viewer" onClick={(e) => e.stopPropagation()}>
            <button className="pg-close" onClick={() => setSelectedPhoto(null)}>×</button>

            {selectedPhoto.url ? (
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || "Photo"}
                className="pg-full-image"
              />
            ) : (
              <div className="pg-no-preview">Photo not available</div>
            )}

            <div className="pg-viewer-info">
              <div className="pg-viewer-row">
                <span className="pg-type-badge">{PHOTO_TYPE_LABELS[selectedPhoto.photoType] ?? selectedPhoto.photoType}</span>
                {selectedPhoto.isCustomerVisible && <span className="pg-visible-badge">Customer Visible</span>}
              </div>
              {selectedPhoto.caption && <p className="pg-viewer-caption">{selectedPhoto.caption}</p>}
              <div className="pg-viewer-meta">
                <span>{selectedPhoto.uploadedBy?.name ?? selectedPhoto.uploadedBy?.email}</span>
                <span>{new Date(selectedPhoto.createdAt).toLocaleString()}</span>
              </div>
              {selectedPhoto.latitude && selectedPhoto.longitude && (
                <div className="pg-viewer-gps">
                  GPS: {selectedPhoto.latitude.toFixed(5)}, {selectedPhoto.longitude.toFixed(5)}
                </div>
              )}
            </div>

            {/* Navigation arrows */}
            <div className="pg-nav">
              <button
                className="pg-nav-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = filteredPhotos.findIndex((p) => p.id === selectedPhoto.id);
                  if (idx > 0) setSelectedPhoto(filteredPhotos[idx - 1]);
                }}
                disabled={filteredPhotos.findIndex((p) => p.id === selectedPhoto.id) === 0}
              >
                ‹
              </button>
              <span className="pg-nav-count">
                {filteredPhotos.findIndex((p) => p.id === selectedPhoto.id) + 1} / {filteredPhotos.length}
              </span>
              <button
                className="pg-nav-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = filteredPhotos.findIndex((p) => p.id === selectedPhoto.id);
                  if (idx < filteredPhotos.length - 1) setSelectedPhoto(filteredPhotos[idx + 1]);
                }}
                disabled={filteredPhotos.findIndex((p) => p.id === selectedPhoto.id) === filteredPhotos.length - 1}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
