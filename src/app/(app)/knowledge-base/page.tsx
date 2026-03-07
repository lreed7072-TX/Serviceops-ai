"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import FileUploader from "@/components/knowledge-base/FileUploader";
import DocumentViewer from "@/components/knowledge-base/DocumentViewer";
import "./knowledge-base.css";

type KbFileItem = {
  id: string;
  title: string;
  sourceUrl: string | null;
  category: string | null;
  tags: string | null;
  status: string;
  createdAt: string;
  files: Array<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }>;
  _count: {
    chunks: number;
  };
};

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "MANUAL", label: "Manuals" },
  { value: "SOP", label: "SOPs" },
  { value: "PRODUCT_DOC", label: "Product Docs" },
  { value: "TRAINING", label: "Training" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SOP: "SOP",
  PRODUCT_DOC: "Product Doc",
  TRAINING: "Training",
  OTHER: "Other",
};

export default function KnowledgeBasePage() {
  const [files, setFiles] = useState<KbFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showUploader, setShowUploader] = useState(false);
  const [viewingFile, setViewingFile] = useState<KbFileItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const toast = useToast();

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (categoryFilter) params.append("category", categoryFilter);

      const res = await apiFetch(`/api/knowledge-base?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load knowledge base");
      const json = await res.json();
      setFiles(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadFiles();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;

    setDeleting(pendingDeleteId);
    try {
      const res = await apiFetch(`/api/knowledge-base/${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      await loadFiles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(null);
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
    if (mimeType.startsWith("image/")) return "🖼️";
    return "📁";
  };

  // Stats
  const totalFiles = files.length;
  const manualCount = files.filter((f) => f.category === "MANUAL").length;
  const sopCount = files.filter((f) => f.category === "SOP").length;
  const trainingCount = files.filter((f) => f.category === "TRAINING").length;

  return (
    <div className="kb-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Knowledge Base</h1>
          <p className="page-subtitle">
            Equipment manuals, SOPs, and technical documentation
          </p>
        </div>
        <button
          onClick={() => setShowUploader(!showUploader)}
          className="btn btn-primary"
        >
          {showUploader ? "Cancel" : "+ Upload Document"}
        </button>
      </div>

      {/* Upload Panel */}
      {showUploader && (
        <div className="kb-upload-section">
          <FileUploader
            onUploadComplete={() => {
              setShowUploader(false);
              loadFiles();
            }}
          />
        </div>
      )}

      {/* Stats */}
      <div className="kb-stats-grid">
        <div className="stat-card">
          <div className="stat-icon kb-stat-total">📚</div>
          <div className="stat-content">
            <h3>{totalFiles}</h3>
            <p>Total Documents</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon kb-stat-manuals">📘</div>
          <div className="stat-content">
            <h3>{manualCount}</h3>
            <p>Manuals</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon kb-stat-sops">📋</div>
          <div className="stat-content">
            <h3>{sopCount}</h3>
            <p>SOPs</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon kb-stat-training">🎓</div>
          <div className="stat-content">
            <h3>{trainingCount}</h3>
            <p>Training</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="kb-filter-bar">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="field-input kb-search-input"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="field-select kb-category-select"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* File Grid */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading documents...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="kb-empty-state">
          <span className="kb-empty-icon">📚</span>
          <h3>No documents yet</h3>
          <p>
            Upload equipment manuals, SOPs, and technical documentation to build
            your knowledge base.
          </p>
          {!showUploader && (
            <button
              onClick={() => setShowUploader(true)}
              className="btn btn-primary"
            >
              Upload First Document
            </button>
          )}
        </div>
      ) : (
        <div className="kb-grid">
          {files.map((file) => {
            const mainFile = file.files[0];
            return (
              <div key={file.id} className="kb-card">
                <div className="kb-card-header">
                  <span className="kb-card-icon">
                    {getFileIcon(mainFile?.mimeType || "")}
                  </span>
                  {file.category && (
                    <span
                      className={`kb-category-badge ${(file.category || "").toLowerCase()}`}
                    >
                      {CATEGORY_LABELS[file.category] || file.category}
                    </span>
                  )}
                </div>

                <h3 className="kb-card-title">{file.title}</h3>

                <div className="kb-card-meta">
                  {mainFile && (
                    <>
                      <span>{mainFile.filename}</span>
                      <span>{formatFileSize(mainFile.sizeBytes)}</span>
                    </>
                  )}
                  {file._count.chunks > 0 && (
                    <span className="kb-chunk-badge">
                      {file._count.chunks} chunks
                    </span>
                  )}
                </div>

                {file.tags && (
                  <div className="kb-card-tags">
                    {file.tags.split(",").map((tag, i) => (
                      <span key={i} className="kb-tag">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}

                <p className="kb-card-date">
                  Uploaded {new Date(file.createdAt).toLocaleDateString()}
                </p>

                <div className="kb-card-actions">
                  <button
                    onClick={() => setViewingFile(file)}
                    className="btn btn-primary kb-action-btn"
                    disabled={!mainFile}
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="btn btn-danger kb-action-btn"
                    disabled={deleting === file.id}
                  >
                    {deleting === file.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewingFile && viewingFile.files[0] && (
        <DocumentViewer
          fileId={viewingFile.files[0].id}
          filename={viewingFile.files[0].filename}
          mimeType={viewingFile.files[0].mimeType}
          title={viewingFile.title}
          onClose={() => setViewingFile(null)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setPendingDeleteId(null); }}
        onConfirm={confirmDelete}
        title="Delete Document"
        message="Delete this document? This cannot be undone."
        detail="All associated data and file content will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting !== null}
      />
    </div>
  );
}
