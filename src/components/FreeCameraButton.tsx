// FREE CAMERA - Toolbar button for general photo capture
// Photos stored in user's personal library, can be applied to WOs later

"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const PHOTO_TYPE_LABELS: Record<string, string> = {
  BEFORE_WORK: "Before Work",
  AFTER_WORK: "After Work",
  NAMEPLATE: "Nameplate",
  DAMAGE: "Damage / Issue",
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

export function FreeCameraButton() {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState("GENERAL");
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Get GPS coordinates
      let gpsLatitude: number | null = null;
      let gpsLongitude: number | null = null;
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          gpsLatitude = position.coords.latitude;
          gpsLongitude = position.coords.longitude;
        } catch (err) {
          console.log("GPS not available");
        }
      }

      // Upload to Supabase Storage
      const supabase = createClient();
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `free-camera/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("work-order-photos")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("work-order-photos")
        .getPublicUrl(fileName);

      // Save to database (free camera photos have no workOrderId)
      const response = await apiFetch("/api/me/free-photos", {
        method: "POST",
        body: JSON.stringify({
          fileName: selectedFile.name,
          storagePath: fileName,
          publicUrl,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          photoType,
          caption,
          gpsLatitude,
          gpsLongitude,
        }),
      });

      if (!response.ok) throw new Error("Failed to save photo");

      // Success - reset form
      setIsOpen(false);
      setPreview(null);
      setSelectedFile(null);
      setCaption("");
      setPhotoType("GENERAL");
      
      alert("Photo saved to your library!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-primary"
        style={{ display: "flex", alignItems: "center", gap: "8px" }}
        title="Take photos anytime - store in your library"
      >
        📷 Camera
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => !uploading && setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <h3>📷 Free Camera</h3>
              <button className="modal-close" onClick={() => setIsOpen(false)} disabled={uploading}>×</button>
            </div>

            <div className="modal-body">
              {!preview ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: "100%",
                      padding: "48px",
                      border: "2px dashed #d1d5db",
                      borderRadius: "8px",
                      background: "#f9fafb",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.background = "#eff6ff";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = "#d1d5db";
                      e.currentTarget.style.background = "#f9fafb";
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "48px", marginBottom: "8px" }}>📷</div>
                      <div style={{ fontSize: "16px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                        Take Photo
                      </div>
                      <div style={{ fontSize: "14px", color: "#6b7280" }}>
                        or select from gallery
                      </div>
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px" }}>
                        Saved to your photo library • Can be applied to work orders later
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <div>
                  <img
                    src={preview}
                    alt="Preview"
                    style={{ width: "100%", borderRadius: "8px", marginBottom: "16px" }}
                  />

                  <div className="form-field">
                    <label>Photo Type</label>
                    <select value={photoType} onChange={(e) => setPhotoType(e.target.value)} disabled={uploading}>
                      {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Notes (Optional)</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Add description or notes..."
                      rows={3}
                      disabled={uploading}
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setPreview(null);
                        setSelectedFile(null);
                      }}
                      disabled={uploading}
                    >
                      Retake
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleUpload}
                      disabled={uploading}
                    >
                      {uploading ? "Saving..." : "Save to Library"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
