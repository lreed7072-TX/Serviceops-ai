"use client";

import { useRef, useState } from "react";
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

type Props = {
  workOrderId: string;
  onPhotoAdded: () => void;
};

export function PhotoCapture({ workOrderId, onPhotoAdded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoType, setPhotoType] = useState("GENERAL");
  const [caption, setCaption] = useState("");
  const [isCustomerVisible, setIsCustomerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Step 1: Get GPS coordinates
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000,
          });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        // GPS not available — continue without
      }

      // Step 2: Request signed upload URL via /api/files/upload
      const uploadRes = await apiFetch("/api/files/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "workOrderPhoto",
          entityId: workOrderId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          label: caption.trim() || photoType,
        }),
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => null);
        throw new Error(errData?.error || "Failed to get upload URL");
      }

      const { data: uploadData } = await uploadRes.json();

      // Step 3: Upload file to Supabase Storage via signed URL
      const putRes = await fetch(uploadData.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("Failed to upload photo to storage");
      }

      // Step 4: Create WorkOrderPhoto record
      const photoRes = await apiFetch(`/api/work-orders/${workOrderId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: uploadData.fileId,
          storageKey: uploadData.storageKey,
          photoType,
          caption: caption.trim() || null,
          latitude,
          longitude,
          isCustomerVisible,
        }),
      });

      if (!photoRes.ok) {
        throw new Error("Failed to save photo record");
      }

      // Reset form
      setCaption("");
      setIsCustomerVisible(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onPhotoAdded();
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pc-container">
      <div className="pc-controls">
        <div className="pc-row">
          <select
            className="pc-select"
            value={photoType}
            onChange={(e) => setPhotoType(e.target.value)}
            disabled={uploading}
          >
            {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label className="pc-checkbox-label">
            <input
              type="checkbox"
              checked={isCustomerVisible}
              onChange={(e) => setIsCustomerVisible(e.target.checked)}
              disabled={uploading}
            />
            Customer visible
          </label>
        </div>

        <input
          type="text"
          className="pc-caption-input"
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={uploading}
        />

        <div className="pc-buttons">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelected}
            style={{ display: "none" }}
            disabled={uploading}
          />
          <button
            className="tech-btn primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Take Photo"}
          </button>
          <button
            className="tech-btn secondary"
            onClick={() => {
              // Open without capture attribute for gallery pick
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute("capture");
                fileInputRef.current.click();
                // Restore capture for next time
                setTimeout(() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute("capture", "environment");
                  }
                }, 100);
              }
            }}
            disabled={uploading}
          >
            Choose from Gallery
          </button>
        </div>
      </div>

      {error && <div className="pc-error">{error}</div>}
    </div>
  );
}
