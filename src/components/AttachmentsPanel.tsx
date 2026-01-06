"use client";

import { Button } from "@/components/ui/Button";
import { useEffect, useState } from "react";

type AttachmentItem = {
  id: string; // fileLink id
  label: string | null;
  createdAt: string;
  file: {
    id: string;
    filename: string;
    mimeType: string;
    storageKey: string;
    sizeBytes: number;
    createdAt: string;
  };
};

export function AttachmentsPanel(props: { entityType: string; entityId: string }) {
  const { entityType, entityId } = props;

  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`/api/files?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load attachments (${res.status})`);
      }
      const json = await res.json();
      setItems(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load attachments.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const prettyBytes = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
    if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
    return "📎";
  };

  const getShortType = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return mimeType.split("/")[1]?.toUpperCase() || "Image";
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Excel";
    if (mimeType.includes("document") || mimeType.includes("word")) return "Word";
    if (mimeType.includes("zip") || mimeType.includes("compressed")) return "ZIP";
    return "File";
  };

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    setErr(null);

    try {
      const createRes = await fetch("/api/files/upload", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          label: label.trim() || null,
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text().catch(() => "");
        throw new Error(text || `Failed to start upload (${createRes.status})`);
      }

      const createJson = await createRes.json();
      const signedUrl = createJson?.data?.signedUrl as string | undefined;

      if (!signedUrl) throw new Error("Upload URL missing.");

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new Error(text || `Upload failed (${putRes.status})`);
      }

      setFile(null);
      setLabel("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (linkId: string) => {
    const prev = items;
    setItems((cur) => cur.filter((x) => x.id !== linkId));
    setErr(null);

    try {
      const res = await fetch(`/api/files/${linkId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }

      load();
    } catch (e: any) {
      setItems(prev);
      setErr(e?.message ?? "Delete failed.");
    }
  };

  const onDownload = async (fileId: string) => {
    try {
      setErr(null);
      const res = await fetch(`/api/files/download?fileId=${encodeURIComponent(fileId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Download failed (${res.status})`);
      }
      const json = await res.json();
      const url = json?.data?.url as string | undefined;
      if (!url) throw new Error("Download URL missing.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message ?? "Download failed.");
    }
  };

  return (
    <div className="attachments-panel">
      {/* Upload Form */}
      <div className="attachment-upload-form">
        <label className="attachment-field">
          <span className="attachment-field-label">Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Pump manual, Spec sheet"
            disabled={uploading}
            className="attachment-input"
          />
        </label>

        <div className="attachment-file-row">
          <label className="attachment-file-btn">
            Choose File
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
          <span className="attachment-file-name">
            {file ? file.name : "No file selected"}
          </span>
        </div>

        <button
          type="button"
          className="tech-btn primary"
          onClick={onUpload}
          disabled={!file || uploading}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {err && <div className="tech-alert error" style={{ marginTop: 12 }}>{err}</div>}

      {/* Attachments List */}
      <div className="attachments-list">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="muted">No attachments yet.</p>
        ) : (
          items.map((it) => (
            <div key={it.id} className="attachment-card">
              <div className="attachment-icon">{getFileIcon(it.file.mimeType)}</div>
              <div className="attachment-info">
                <div className="attachment-filename">{it.file.filename}</div>
                <div className="attachment-meta">
                  {it.label && <span className="attachment-label">{it.label}</span>}
                  <span>{getShortType(it.file.mimeType)}</span>
                  <span>•</span>
                  <span>{prettyBytes(it.file.sizeBytes)}</span>
                </div>
              </div>
              <div className="attachment-actions">
                <button
                  type="button"
                  className="attachment-action-btn"
                  onClick={() => onDownload(it.file.id)}
                  title="Download"
                >
                  ⬇️
                </button>
                <button
                  type="button"
                  className="attachment-action-btn delete"
                  onClick={() => onDelete(it.id)}
                  title="Remove"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
