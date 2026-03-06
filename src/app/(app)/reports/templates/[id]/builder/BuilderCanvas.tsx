"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { apiFetch } from "@/lib/api";
import type { TemplateDefinition, TemplateField } from "./types";
import FieldCard from "./FieldCard";
import PropertiesPanel from "./PropertiesPanel";
import AddFieldModal from "./AddFieldModal";
import TemplateSettings from "./TemplateSettings";

/* ─── Helpers ─── */

interface TemplatePayload {
  id: string;
  name: string;
  status: string;
  schemaVersion: number;
  definition: TemplateDefinition | Record<string, never>;
}

interface ApiResponse<T> {
  data: T;
}

const DEFAULT_DEFINITION: TemplateDefinition = {
  version: 1,
  settings: {
    requireAllFields: false,
    allowPhotoEvidence: true,
    coverPage: {
      enabled: false,
      showLogo: true,
      showCustomerName: true,
      subtitle: "",
    },
  },
  sections: [],
};

const DEFAULT_TITLES: Record<string, string> = {
  TEXT_INPUT: "Text Field",
  TEXTAREA: "Long Text",
  NUMERIC_INPUT: "Numeric Reading",
  YES_NO: "Yes / No",
  DROPDOWN: "Dropdown",
  MULTI_SELECT: "Multi-Select",
  DATE_INPUT: "Date",
  PHOTO_CAPTURE: "Photo",
  SIGNATURE: "Signature",
  GPS_CAPTURE: "GPS Location",
  SECTION_HEADER: "New Section",
  INSTRUCTIONS: "Instructions",
  CALCULATED: "Calculated Field",
};

function isValidDefinition(def: unknown): def is TemplateDefinition {
  if (!def || typeof def !== "object") return false;
  const d = def as Record<string, unknown>;
  return Array.isArray(d.sections) && typeof d.settings === "object" && typeof d.version === "number";
}

/* ─── Component ─── */

interface BuilderCanvasProps {
  templateId: string;
}

export default function BuilderCanvas({ templateId }: BuilderCanvasProps) {
  const [template, setTemplate] = useState<TemplatePayload | null>(null);
  const [definition, setDefinition] = useState<TemplateDefinition>(DEFAULT_DEFINITION);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"" | "saved" | "error">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const dragIndexRef = useRef<number | null>(null);

  /* ─── Load template ─── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await apiFetch(`/api/report-templates/${templateId}`);
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? `Failed to load template (${res.status})`);
        }
        const payload = (await res.json()) as ApiResponse<TemplatePayload>;
        if (cancelled) return;

        const tpl = payload.data;
        setTemplate(tpl);

        if (isValidDefinition(tpl.definition)) {
          setDefinition(tpl.definition);
        } else {
          setDefinition(DEFAULT_DEFINITION);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load template.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [templateId]);

  /* ─── Mark dirty on definition change (skip initial load) ─── */
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    setIsDirty(true);
    setSaveStatus("");
  }, [definition]);

  /* ─── Core actions ─── */

  const handleAddField = useCallback((type: string) => {
    const blockId = crypto.randomUUID();
    const newField: TemplateField = {
      blockId,
      type,
      title: DEFAULT_TITLES[type] ?? type,
      props: type === "DROPDOWN" || type === "MULTI_SELECT" ? { options: ["Option 1"] } : {},
      sortOrder: definition.sections.length,
    };

    setDefinition((prev) => ({
      ...prev,
      sections: [...prev.sections, newField],
    }));
    setSelectedBlockId(blockId);
  }, [definition.sections.length]);

  const handleUpdateField = useCallback((updated: TemplateField) => {
    setDefinition((prev) => ({
      ...prev,
      sections: prev.sections.map((f) => (f.blockId === updated.blockId ? updated : f)),
    }));
  }, []);

  const handleDeleteField = useCallback((blockId: string) => {
    setDefinition((prev) => ({
      ...prev,
      sections: prev.sections
        .filter((f) => f.blockId !== blockId)
        .map((f, i) => ({ ...f, sortOrder: i })),
    }));
    setSelectedBlockId((prev) => (prev === blockId ? null : prev));
  }, []);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setDefinition((prev) => {
      const items = [...prev.sections];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return {
        ...prev,
        sections: items.map((f, i) => ({ ...f, sortOrder: i })),
      };
    });
  }, []);

  /* ─── Drag handlers ─── */
  const handleDragStart = useCallback((index: number) => (e: DragEvent<HTMLDivElement>) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
    const target = e.currentTarget;
    requestAnimationFrame(() => target.classList.add("field-card--dragging"));
  }, []);

  const handleDragOver = useCallback((_index: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((toIndex: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex !== null && fromIndex !== toIndex) {
      handleReorder(fromIndex, toIndex);
    }
    dragIndexRef.current = null;
    // Clear dragging class from all cards
    document.querySelectorAll(".field-card--dragging").forEach((el) => {
      el.classList.remove("field-card--dragging");
    });
  }, [handleReorder]);

  /* ─── Save ─── */
  const handleSave = useCallback(async () => {
    if (!template || isSaving) return;
    setIsSaving(true);
    setSaveStatus("");

    try {
      const res = await apiFetch(`/api/report-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }

      const payload = (await res.json()) as ApiResponse<TemplatePayload>;
      setTemplate(payload.data);
      setIsDirty(false);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [template, isSaving, definition]);

  /* ─── Publish ─── */
  const handlePublish = useCallback(async () => {
    if (!template || isSaving) return;

    // Save first if dirty
    if (isDirty) {
      await handleSave();
    }

    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/report-templates/${template.id}/publish`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Publish failed");
      }

      const payload = (await res.json()) as ApiResponse<TemplatePayload>;
      setTemplate(payload.data);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Publish error:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [template, isSaving, isDirty, handleSave]);

  /* ─── Keyboard shortcut: Ctrl+S ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  /* ─── Selected field reference ─── */
  const selectedField = selectedBlockId
    ? definition.sections.find((f) => f.blockId === selectedBlockId) ?? null
    : null;

  /* ─── Render states ─── */

  if (loading) {
    return (
      <div className="builder-loading">
        <div className="builder-spinner" />
        <p>Loading template...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="builder-error">
        <h2>Error</h2>
        <p>{error ?? "Template not found."}</p>
        <Link href="/reports/templates">Back to templates</Link>
      </div>
    );
  }

  const statusClass = template.status.toLowerCase();

  return (
    <div className="builder-layout">
      {/* ─── Header ─── */}
      <div className="builder-header">
        <Link className="builder-back-link" href="/reports/templates">
          &larr; Templates
        </Link>
        <h1 className="builder-title">{template.name}</h1>
        <span className={`builder-status-badge ${statusClass}`}>
          {template.status}
        </span>
        {isDirty && <span className="builder-dirty-indicator" title="Unsaved changes" />}
        {saveStatus && (
          <span className={`builder-save-status ${saveStatus}`}>
            {saveStatus === "saved" ? "Saved" : "Save failed"}
          </span>
        )}
        <div className="builder-header-actions">
          <button
            className="builder-btn-save"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            className="builder-btn-publish"
            onClick={handlePublish}
            disabled={isSaving}
          >
            Publish
          </button>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div className="builder-body">
        {/* Canvas */}
        <div className="canvas">
          {definition.sections.length === 0 ? (
            <div className="canvas-empty">
              <div className="canvas-empty-icon">+</div>
              <h3>No fields yet</h3>
              <p>Click the button below to add your first field</p>
            </div>
          ) : (
            definition.sections.map((field, index) => (
              <FieldCard
                key={field.blockId}
                field={field}
                isSelected={selectedBlockId === field.blockId}
                onSelect={() => setSelectedBlockId(field.blockId)}
                onDelete={() => handleDeleteField(field.blockId)}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
              />
            ))
          )}
          <button
            className="canvas-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Add Field
          </button>

          {/* Template Settings at the bottom of the canvas */}
          <TemplateSettings definition={definition} onChange={setDefinition} />
        </div>

        {/* Properties Panel */}
        <PropertiesPanel
          field={selectedField}
          allFields={definition.sections}
          onChange={handleUpdateField}
        />
      </div>

      {/* Add Field Modal */}
      {showAddModal && (
        <AddFieldModal
          onAdd={handleAddField}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
