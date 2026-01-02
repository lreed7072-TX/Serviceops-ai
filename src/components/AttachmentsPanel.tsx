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

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    setErr(null);

    try {
      // 1) Ask server for signed upload URL + create File + FileLink
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

      // 2) Upload bytes directly to Supabase Storage
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new Error(text || `Upload failed (${putRes.status})`);
      }

      // 3) Reset UI + refresh list
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
    // Optimistic UI: remove immediately to keep interaction snappy (better INP).
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

      // Refresh in background (don’t block the click)
      load();
    } catch (e: any) {
      // Revert if delete failed
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
    <div className="card">
      <div className="card-header">
        <h3>Attachments</h3>
        <button type="button" className="link-button" onClick={load} disabled={loading || uploading}>
          Refresh
        </button>
      </div>

      {err ? <p className="form-feedback error">{err}</p> : null}

      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <label className="form-field">
          <span>Label (optional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Pump manual, Startup checklist, Spec sheet"
            disabled={uploading}
          />
        </label>

        <label className="form-field">
          <span>File</span>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
        </label>

        <div className="form-actions">
          <button type="button" onClick={onUpload} disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading attachments…</p>
      ) : items.length === 0 ? (
        <p className="muted">No attachments yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Label</th>
              <th>Type</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={{ wordBreak: "break-word" }}>{it.file.filename}</td>
                <td>{it.label ?? "—"}</td>
                <td>{it.file.mimeType}</td>
                <td>{prettyBytes(it.file.sizeBytes)}</td>
                <td>{new Date(it.file.createdAt).toLocaleString()}</td>
                <td>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <Button variant="secondary" type="button" onClick={() => onDownload(it.file.id)}>Download</Button>
                    <Button variant="secondary" type="button" onClick={() => onDelete(it.id)}>Remove</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
