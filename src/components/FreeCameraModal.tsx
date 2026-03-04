"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

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

export function FreeCameraModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoType, setPhotoType] = useState("GENERAL");
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const toast = useToast();

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
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("photoType", photoType);
      formData.append("caption", caption);

      const response = await apiFetch("/api/tech/photos/free", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Success
        setPreview(null);
        setSelectedFile(null);
        setCaption("");
        setPhotoType("GENERAL");
        toast.success("Photo saved to your library!");
        onClose();
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setSelectedFile(null);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>📷 Free Camera</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
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
                className="btn btn-primary"
                style={{ 
                  width: "100%", 
                  padding: "3rem 1rem",
                  fontSize: "1.125rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.5rem"
                }}
              >
                <span style={{ fontSize: "3rem" }}>📷</span>
                <span>Take Photo</span>
                <span style={{ fontSize: "0.875rem", opacity: 0.8 }}>or select from gallery</span>
              </button>
              
              <div style={{ marginTop: "1rem", padding: "1rem", background: "#f3f4f6", borderRadius: "0.5rem" }}>
                <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
                  <strong>💡 Tip:</strong> Photos taken here are saved to your personal library. 
                  You can attach them to work orders later or keep them for reference.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: "1rem" }}>
                <img
                  src={preview}
                  alt="Preview"
                  style={{ width: "100%", borderRadius: "0.5rem" }}
                />
              </div>

              <div className="form-field">
                <label>Photo Type</label>
                <select
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value)}
                  className="form-control"
                >
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
                  placeholder="Add description, measurements, observations..."
                  rows={3}
                  className="form-control"
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleRetake}
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
  );
}