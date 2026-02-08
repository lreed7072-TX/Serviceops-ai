"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

const CATEGORIES = [
  { value: "MANUAL", label: "Equipment Manual" },
  { value: "SOP", label: "Standard Operating Procedure" },
  { value: "PRODUCT_DOC", label: "Product Documentation" },
  { value: "TRAINING", label: "Training Material" },
  { value: "OTHER", label: "Other" },
];

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function FileUploader({
  onUploadComplete,
}: {
  onUploadComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("MANUAL");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Unsupported file type. Upload PDF, Word, or images.");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;

    setUploading(true);
    setError("");

    try {
      // Step 1: Create records and get signed upload URL
      const createRes = await apiFetch("/api/knowledge-base/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          title,
          category,
          tags: tags.trim() || null,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        throw new Error(
          (data as Record<string, string>).error || "Failed to start upload"
        );
      }

      const createJson = await createRes.json();
      const signedUrl = createJson?.data?.signedUrl as string | undefined;
      if (!signedUrl) throw new Error("Upload URL missing.");

      // Step 2: PUT file binary directly to Supabase Storage
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("File upload failed. Please try again.");
      }

      // Success — reset form
      setFile(null);
      setTitle("");
      setTags("");
      setCategory("MANUAL");
      onUploadComplete();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="kb-uploader">
      {/* Drag & Drop Zone */}
      <div
        className={`kb-dropzone ${dragActive ? "dragover" : ""} ${file ? "has-file" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById("kb-file-input")?.click()}
      >
        <input
          id="kb-file-input"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          onChange={(e) =>
            e.target.files?.[0] && handleFileSelect(e.target.files[0])
          }
          style={{ display: "none" }}
        />

        {file ? (
          <div className="kb-file-selected">
            <span className="kb-file-icon">
              {file.type.includes("pdf")
                ? "📄"
                : file.type.includes("image")
                  ? "🖼️"
                  : "📝"}
            </span>
            <div className="kb-file-info">
              <strong>{file.name}</strong>
              <span className="kb-file-size">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setTitle("");
              }}
              className="kb-file-remove"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="kb-dropzone-content">
            <span className="kb-upload-icon">📤</span>
            <p>
              <strong>Drag and drop</strong> or{" "}
              <span className="kb-browse-link">browse</span>
            </p>
            <p className="kb-dropzone-hint">PDF, Word, or images up to 10MB</p>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Metadata Fields */}
      <div className="kb-upload-fields">
        <div className="form-field">
          <label className="field-label">Title *</label>
          <input
            type="text"
            className="field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            required
          />
        </div>

        <div className="form-field">
          <label className="field-label">Category *</label>
          <select
            className="field-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field kb-tags-field">
          <label className="field-label">Tags (comma-separated)</label>
          <input
            type="text"
            className="field-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="pump, maintenance, troubleshooting"
          />
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary kb-upload-btn"
        disabled={!file || !title || uploading}
      >
        {uploading ? "Uploading..." : "Upload Document"}
      </button>
    </form>
  );
}
