"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import "./EvidenceCapture.css";

type Evidence = {
  id: string;
  type: "NOTE" | "PHOTO" | "FILE";
  noteText: string | null;
  url: string | null;
  createdAt: string;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
  };
};

interface EvidenceCaptureProps {
  taskId: string;
  onEvidenceAdded: () => void;
}

export default function EvidenceCapture({ taskId, onEvidenceAdded }: EvidenceCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchEvidence = async () => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/evidence`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setEvidence(json.data ?? []);
      }
    } catch {
      // Silently fail — evidence list is supplementary
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Add a text note
  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "NOTE", noteText: noteText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      setNoteText("");
      setShowNoteForm(false);
      await fetchEvidence();
      onEvidenceAdded();
    } catch {
      setError("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  // Upload photo/file via Supabase signed URL, then create evidence
  const handleFileUpload = async (file: File, evidenceType: "PHOTO" | "FILE") => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Step 1: Create file record + get signed upload URL
      const createRes = await apiFetch("/api/files/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entityType: "task_evidence",
          entityId: taskId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          label: evidenceType === "PHOTO" ? "Task Photo" : "Task File",
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error((errData as Record<string, string>).error || "Upload setup failed");
      }

      const createJson = await createRes.json();
      const signedUrl = createJson?.data?.signedUrl as string | undefined;
      const fileId = createJson?.data?.fileId as string | undefined;
      if (!signedUrl || !fileId) throw new Error("Upload URL missing");

      // Step 2: PUT file binary to Supabase Storage
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error("File upload failed");

      // Step 3: Get download URL
      const dlRes = await apiFetch(
        `/api/files/download?fileId=${encodeURIComponent(fileId)}`,
        { cache: "no-store" }
      );
      if (!dlRes.ok) throw new Error("Failed to get download URL");
      const dlJson = await dlRes.json();
      const downloadUrl = dlJson?.data?.url as string | undefined;
      if (!downloadUrl) throw new Error("Download URL missing");

      // Step 4: Create evidence record with the URL
      const evRes = await apiFetch(`/api/tasks/${taskId}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: evidenceType, url: downloadUrl }),
      });
      if (!evRes.ok) throw new Error("Failed to create evidence");

      await fetchEvidence();
      onEvidenceAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset file inputs
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="ec-container">
      {/* Action Buttons */}
      <div className="ec-actions">
        <button
          className="btn btn-primary ec-btn"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
        >
          📷 Photo
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) =>
            e.target.files?.[0] && handleFileUpload(e.target.files[0], "PHOTO")
          }
        />

        <button
          className="btn btn-secondary ec-btn"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          📁 File
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={(e) =>
            e.target.files?.[0] && handleFileUpload(e.target.files[0], "FILE")
          }
        />

        <button
          className="btn btn-secondary ec-btn"
          onClick={() => setShowNoteForm(!showNoteForm)}
          disabled={uploading}
        >
          📝 Note
        </button>
      </div>

      {uploading && (
        <div className="ec-uploading">Uploading...</div>
      )}

      {error && <div className="ec-error">{error}</div>}

      {/* Note Form */}
      {showNoteForm && (
        <div className="ec-note-form">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter your note..."
            rows={3}
            className="ec-note-input"
            autoFocus
          />
          <div className="ec-note-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowNoteForm(false);
                setNoteText("");
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddNote}
              disabled={!noteText.trim() || savingNote}
            >
              {savingNote ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      )}

      {/* Evidence List */}
      <div className="ec-list">
        {loading ? (
          <p className="ec-muted">Loading evidence...</p>
        ) : evidence.length === 0 ? (
          <p className="ec-muted">No evidence captured yet</p>
        ) : (
          evidence.map((item) => (
            <div key={item.id} className="ec-item">
              <span className="ec-item-icon">
                {item.type === "PHOTO" && "📷"}
                {item.type === "FILE" && "📁"}
                {item.type === "NOTE" && "📝"}
              </span>
              <div className="ec-item-content">
                {item.type === "NOTE" && item.noteText && (
                  <p className="ec-note-text">{item.noteText}</p>
                )}
                {item.url && item.type === "PHOTO" && (
                  <img
                    src={item.url}
                    alt="Evidence"
                    className="ec-thumbnail"
                    onClick={() => window.open(item.url!, "_blank")}
                  />
                )}
                {item.url && item.type === "FILE" && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ec-file-link"
                  >
                    View File
                  </a>
                )}
                <div className="ec-item-meta">
                  <span>{item.createdByUser.name || item.createdByUser.email}</span>
                  <span>•</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
