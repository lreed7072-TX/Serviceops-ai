"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type TechPhoto = {
  id: string;
  photoType: string;
  caption: string | null;
  fileName: string;
  fileUrl: string;
  capturedAt: string;
  workOrderId: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
};

const PHOTO_TYPE_LABELS: Record<string, string> = {
  BEFORE_WORK: "Before",
  AFTER_WORK: "After",
  NAMEPLATE: "Nameplate",
  DAMAGE: "Damage",
  SAFETY_HAZARD: "Safety",
  MEASUREMENT: "Measurement",
  PARTS: "Parts",
  INSTALLATION: "Install",
  WIRING: "Wiring",
  CORROSION: "Corrosion",
  LEAK: "Leak",
  ALIGNMENT: "Alignment",
  GENERAL: "General",
};

export default function PhotoLibraryPage() {
  const [photos, setPhotos] = useState<TechPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedPhoto, setSelectedPhoto] = useState<TechPhoto | null>(null);

  useEffect(() => {
    loadPhotos();
  }, [filter]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const url = filter === "ALL" 
        ? "/api/tech/photos/free"
        : `/api/tech/photos/free?photoType=${filter}`;
      
      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        setPhotos(json.photos);
      }
    } catch (error) {
      console.error("Failed to load photos:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tech-container">
      <div className="tech-header">
        <h1>📷 My Photo Library</h1>
        <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>
          Photos taken with the free camera. Attach them to work orders or keep for reference.
        </p>
      </div>

      <div className="tech-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <strong>{photos.length}</strong> photo{photos.length !== 1 ? "s" : ""}
          </div>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="form-control"
            style={{ width: "200px" }}
          >
            <option value="ALL">All Types</option>
            {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#9ca3af" }}>
            Loading photos...
          </div>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📷</div>
            <div style={{ color: "#6b7280", fontSize: "1.125rem" }}>
              No photos yet
            </div>
            <div style={{ color: "#9ca3af", marginTop: "0.5rem" }}>
              Use the camera button to take photos
            </div>
          </div>
        ) : (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "1rem"
          }}>
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                style={{
                  cursor: "pointer",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  overflow: "hidden",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ 
                  aspectRatio: "1", 
                  background: "#f3f4f6", 
                  position: "relative" 
                }}>
                  <img
                    src={photo.fileUrl}
                    alt={photo.caption || photo.photoType}
                    style={{ 
                      width: "100%", 
                      height: "100%", 
                      objectFit: "cover" 
                    }}
                  />
                  {photo.workOrderId && (
                    <div style={{
                      position: "absolute",
                      top: "0.5rem",
                      right: "0.5rem",
                      background: "#10b981",
                      color: "white",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}>
                      Attached
                    </div>
                  )}
                </div>
                <div style={{ padding: "0.75rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                    {PHOTO_TYPE_LABELS[photo.photoType]}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    {new Date(photo.capturedAt).toLocaleDateString()}
                  </div>
                  {photo.caption && (
                    <div style={{ 
                      fontSize: "0.75rem", 
                      color: "#9ca3af", 
                      marginTop: "0.25rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {photo.caption}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Screen Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            zIndex: 50,
          }}
        >
          <div style={{ maxWidth: "900px", width: "100%" }}>
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                color: "white",
                fontSize: "2rem",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <img
              src={selectedPhoto.fileUrl}
              alt={selectedPhoto.caption || selectedPhoto.photoType}
              style={{
                width: "100%",
                height: "auto",
                borderRadius: "0.5rem",
              }}
            />

            <div style={{ marginTop: "1.5rem", color: "white" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                {PHOTO_TYPE_LABELS[selectedPhoto.photoType]}
              </div>
              
              {selectedPhoto.caption && (
                <div style={{ color: "#d1d5db", marginBottom: "0.75rem" }}>
                  {selectedPhoto.caption}
                </div>
              )}

              <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                Captured: {new Date(selectedPhoto.capturedAt).toLocaleString()}
              </div>

              {selectedPhoto.gpsLatitude && selectedPhoto.gpsLongitude && (
                <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                  GPS: {selectedPhoto.gpsLatitude.toFixed(6)}, {selectedPhoto.gpsLongitude.toFixed(6)}
                </div>
              )}

              {selectedPhoto.workOrderId && (
                <div style={{ marginTop: "0.75rem", color: "#10b981" }}>
                  ✓ Attached to Work Order
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
