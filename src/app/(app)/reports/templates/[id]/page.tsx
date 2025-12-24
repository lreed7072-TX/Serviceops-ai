"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReportBlock, ReportTemplate } from "@prisma/client";
import { apiFetch } from "@/lib/api";

type TemplateWithBlocks = ReportTemplate & { blocks: ReportBlock[] };

type SingleResponse<T> = {
  data: T;
};

const allowedRoles = ["ADMIN", "DISPATCHER"] as const;

const getDevRole = (): string | null => {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_DEV_ROLE ?? null;
  }

  try {
    const raw = window.localStorage.getItem("devAuth");
    if (!raw) {
      return process.env.NEXT_PUBLIC_DEV_ROLE ?? null;
    }
    const parsed = JSON.parse(raw) as { role?: string };
    return parsed.role ?? process.env.NEXT_PUBLIC_DEV_ROLE ?? null;
  } catch {
    return process.env.NEXT_PUBLIC_DEV_ROLE ?? null;
  }
};

const defaultHeadingProps = { level: 2 };
const defaultRichTextProps = { text: "" };

const getBlockTitle = (block: ReportBlock) => block.title ?? "";

const getBlockText = (block: ReportBlock) => {
  const props = block.props as { text?: string } | null;
  return props?.text ?? "";
};

const getBlockLevel = (block: ReportBlock) => {
  const props = block.props as { level?: number } | null;
  return props?.level ?? 2;
};

export default function ReportTemplateDetailPage() {
  const params = useParams();
  const templateId = params?.id as string | undefined;
  const [template, setTemplate] = useState<TemplateWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const canWrite = useMemo(
    () => (role ? allowedRoles.includes(role as (typeof allowedRoles)[number]) : true),
    [role]
  );

  const loadTemplate = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/report-templates/${templateId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load template.");
      }
      const payload = (await response.json()) as SingleResponse<TemplateWithBlocks>;
      setTemplate(payload.data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load template.");
      setTemplate(null);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    setRole(getDevRole());
    loadTemplate();
  }, [loadTemplate]);

  const orderedBlocks = useMemo(() => {
    if (!template?.blocks) return [];
    return [...template.blocks].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [template?.blocks]);

  const handleAddBlock = async (type: "HEADING" | "RICH_TEXT") => {
    if (!templateId) return;
    setSaving(true);
    setError(null);
    try {
      const sortOrder =
        orderedBlocks.length > 0 ? orderedBlocks[orderedBlocks.length - 1].sortOrder + 1 : 0;
      const response = await apiFetch(`/api/report-templates/${templateId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: type === "HEADING" ? "Heading" : "Rich text",
          props: type === "HEADING" ? defaultHeadingProps : defaultRichTextProps,
          sortOrder,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to add block.");
      }
      await loadTemplate();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to add block.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBlock = async (
    blockId: string,
    data: { title?: string | null; props?: Record<string, unknown> }
  ) => {
    if (data.title !== undefined && data.title !== null && data.title.trim().length === 0) {
      setError("Heading title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/report-blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to update block.");
      }
      await loadTemplate();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update block.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/report-blocks/${blockId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete block.");
      }
      await loadTemplate();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete block.");
    } finally {
      setSaving(false);
    }
  };

  const handleMoveBlock = async (block: ReportBlock, direction: "up" | "down") => {
    const index = orderedBlocks.findIndex((item) => item.id === block.id);
    if (index === -1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= orderedBlocks.length) return;

    const swapTarget = orderedBlocks[swapIndex];
    setSaving(true);
    setError(null);

    try {
      await Promise.all([
        apiFetch(`/api/report-blocks/${block.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: swapTarget.sortOrder }),
        }),
        apiFetch(`/api/report-blocks/${swapTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: block.sortOrder }),
        }),
      ]);
      await loadTemplate();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to reorder blocks.");
    } finally {
      setSaving(false);
    }
  };

  if (!templateId) {
    return (
      <div className="card">
        <p>Missing template ID in URL.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Report Template</h2>
          <p>Build the outline for generated reports.</p>
        </div>
        <Link className="link-button" href="/reports/templates">
          ← Back to templates
        </Link>
      </div>

      {error && <div className="page-alert error">{error}</div>}
      {loading && !error && <div className="page-alert info">Loading template…</div>}

      {template && (
        <div className="card">
          <h3>{template.name}</h3>
          <p className="muted">{template.status}</p>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Blocks</h3>
          <button type="button" className="link-button" onClick={loadTemplate}>
            Refresh
          </button>
        </div>

        {canWrite && (
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => handleAddBlock("HEADING")} disabled={saving}>
              Add Heading
            </button>
            <button type="button" onClick={() => handleAddBlock("RICH_TEXT")} disabled={saving}>
              Add Rich Text
            </button>
          </div>
        )}

        {!canWrite && (
          <p className="muted">You do not have permission to edit blocks.</p>
        )}

        {template && orderedBlocks.length === 0 && <p>No blocks yet.</p>}

        {template && orderedBlocks.length > 0 && (
          <ul className="task-list">
            {orderedBlocks.map((block) => (
              <li key={block.id} className="task-item">
                <div className="task-meta-row">
                  <div>
                    <strong>{block.type.replace("_", " ")}</strong>
                    <p className="muted">{getBlockTitle(block) || "Untitled block"}</p>
                  </div>
                  {canWrite && (
                    <div className="task-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleMoveBlock(block, "up")}
                        disabled={saving}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleMoveBlock(block, "down")}
                        disabled={saving}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="link-button danger"
                        onClick={() => handleDeleteBlock(block.id)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {block.type === "HEADING" && (
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Title</span>
                      <input
                        defaultValue={getBlockTitle(block)}
                        onBlur={(event) => {
                          handleUpdateBlock(block.id, { title: event.target.value || null });
                        }}
                        disabled={!canWrite || saving}
                      />
                    </label>
                    <label className="form-field">
                      <span>Level</span>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        defaultValue={getBlockLevel(block)}
                        onBlur={(event) => {
                          const level = Number(event.target.value);
                          handleUpdateBlock(block.id, {
                            props: { level: Number.isNaN(level) ? 2 : level },
                          });
                        }}
                        disabled={!canWrite || saving}
                      />
                    </label>
                  </div>
                )}

                {block.type === "RICH_TEXT" && (
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Title</span>
                      <input
                        defaultValue={getBlockTitle(block)}
                        onBlur={(event) => {
                          handleUpdateBlock(block.id, { title: event.target.value || null });
                        }}
                        disabled={!canWrite || saving}
                      />
                    </label>
                    <label className="form-field">
                      <span>Text</span>
                      <textarea
                        rows={4}
                        defaultValue={getBlockText(block)}
                        onBlur={(event) => {
                          handleUpdateBlock(block.id, { props: { text: event.target.value } });
                        }}
                        disabled={!canWrite || saving}
                      />
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
