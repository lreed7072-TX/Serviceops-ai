"use client";

import type { TemplateField, CalcOperation } from "./types";

const CALC_OPERATIONS: CalcOperation[] = [
  "SUM", "SUBTRACT", "MULTIPLY", "DIVIDE", "AVERAGE", "MIN", "MAX", "COUNT",
];

const NO_REQUIRED_TYPES = new Set(["SECTION_HEADER", "INSTRUCTIONS", "CALCULATED"]);

function friendlyType(type: string): string {
  const map: Record<string, string> = {
    TEXT_INPUT: "Text Input",
    TEXTAREA: "Long Text",
    NUMERIC_INPUT: "Number",
    YES_NO: "Yes / No",
    DROPDOWN: "Dropdown",
    MULTI_SELECT: "Multi-Select",
    DATE_INPUT: "Date",
    PHOTO_CAPTURE: "Photo",
    SIGNATURE: "Signature",
    GPS_CAPTURE: "GPS Location",
    SECTION_HEADER: "Section Header",
    INSTRUCTIONS: "Instructions",
    CALCULATED: "Calculated Field",
  };
  return map[type] || type;
}

interface PropertiesPanelProps {
  field: TemplateField | null;
  allFields: TemplateField[];
  onChange: (updated: TemplateField) => void;
}

export default function PropertiesPanel({ field, allFields, onChange }: PropertiesPanelProps) {
  if (!field) {
    return (
      <div className="properties-panel">
        <div className="properties-panel-empty">
          <p>Select a field to edit its properties</p>
        </div>
      </div>
    );
  }

  const update = (patch: Partial<TemplateField>) => {
    onChange({ ...field, ...patch });
  };

  const updateProp = (key: string, value: unknown) => {
    onChange({ ...field, props: { ...field.props, [key]: value } });
  };

  const numericFields = allFields.filter((f) => f.type === "NUMERIC_INPUT" && f.blockId !== field.blockId);

  const showRequired = !NO_REQUIRED_TYPES.has(field.type);

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <h3>Properties</h3>
        <span className="properties-panel-type">{friendlyType(field.type)}</span>
      </div>

      {/* ─── Common: Title ─── */}
      <div className="properties-field-group">
        <label htmlFor="prop-label">Label</label>
        <input
          id="prop-label"
          type="text"
          value={field.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Field label"
        />
      </div>

      {/* ─── Common: Help Text (not for SECTION_HEADER) ─── */}
      {field.type !== "SECTION_HEADER" && (
        <div className="properties-field-group">
          <label htmlFor="prop-help">Help Text</label>
          <input
            id="prop-help"
            type="text"
            value={field.props.helpText ?? ""}
            onChange={(e) => updateProp("helpText", e.target.value || undefined)}
            placeholder="Hint shown below the field"
          />
        </div>
      )}

      {/* ─── Common: Required ─── */}
      {showRequired && (
        <div className="properties-checkbox-row">
          <input
            id="prop-required"
            type="checkbox"
            checked={field.props.required ?? false}
            onChange={(e) => updateProp("required", e.target.checked)}
          />
          <label htmlFor="prop-required">Required</label>
        </div>
      )}

      <hr className="properties-divider" />

      {/* ─── NUMERIC_INPUT ─── */}
      {field.type === "NUMERIC_INPUT" && (
        <>
          <div className="properties-field-group">
            <label htmlFor="prop-unit">Unit</label>
            <input
              id="prop-unit"
              type="text"
              value={field.props.unit ?? ""}
              onChange={(e) => updateProp("unit", e.target.value || undefined)}
              placeholder="e.g., PSI, RPM, &deg;F"
            />
          </div>
          <div className="properties-field-group">
            <label htmlFor="prop-min">Min Value</label>
            <input
              id="prop-min"
              type="number"
              value={field.props.minValue ?? ""}
              onChange={(e) =>
                updateProp("minValue", e.target.value === "" ? undefined : Number(e.target.value))
              }
            />
          </div>
          <div className="properties-field-group">
            <label htmlFor="prop-max">Max Value</label>
            <input
              id="prop-max"
              type="number"
              value={field.props.maxValue ?? ""}
              onChange={(e) =>
                updateProp("maxValue", e.target.value === "" ? undefined : Number(e.target.value))
              }
            />
          </div>
        </>
      )}

      {/* ─── DROPDOWN / MULTI_SELECT — Options ─── */}
      {(field.type === "DROPDOWN" || field.type === "MULTI_SELECT") && (
        <div className="properties-field-group">
          <label>Options</label>
          <div className="properties-options-list">
            {(field.props.options ?? []).map((option, index) => (
              <div className="properties-option-row" key={index}>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const updated = [...(field.props.options ?? [])];
                    updated[index] = e.target.value;
                    updateProp("options", updated);
                  }}
                  placeholder={`Option ${index + 1}`}
                />
                <button
                  className="properties-option-delete"
                  title="Remove option"
                  onClick={() => {
                    const updated = (field.props.options ?? []).filter((_, i) => i !== index);
                    updateProp("options", updated);
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button
            className="properties-add-option-btn"
            onClick={() => updateProp("options", [...(field.props.options ?? []), ""])}
          >
            + Add Option
          </button>
        </div>
      )}

      {/* ─── CALCULATED ─── */}
      {field.type === "CALCULATED" && (
        <>
          <div className="properties-field-group">
            <label htmlFor="prop-operation">Operation</label>
            <select
              id="prop-operation"
              value={field.props.formula ?? "SUM"}
              onChange={(e) => updateProp("formula", e.target.value as CalcOperation)}
            >
              {CALC_OPERATIONS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <div className="properties-field-group">
            <label>Input Fields</label>
            {numericFields.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "#9ca3af", margin: 0 }}>
                Add numeric fields first
              </p>
            ) : (
              <div className="properties-calc-inputs">
                {numericFields.map((nf) => (
                  <div className="properties-calc-input-row" key={nf.blockId}>
                    <input
                      type="checkbox"
                      id={`calc-input-${nf.blockId}`}
                      checked={(field.props.inputs ?? []).includes(nf.blockId)}
                      onChange={(e) => {
                        const current = field.props.inputs ?? [];
                        const updated = e.target.checked
                          ? [...current, nf.blockId]
                          : current.filter((id) => id !== nf.blockId);
                        updateProp("inputs", updated);
                      }}
                    />
                    <label htmlFor={`calc-input-${nf.blockId}`}>
                      <span>{nf.title || "Untitled"}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── PHOTO_CAPTURE ─── */}
      {field.type === "PHOTO_CAPTURE" && (
        <>
          <div className="properties-field-group">
            <label htmlFor="prop-max-photos">Max Photos</label>
            <input
              id="prop-max-photos"
              type="number"
              min={1}
              value={field.props.maxPhotos ?? ""}
              onChange={(e) =>
                updateProp("maxPhotos", e.target.value === "" ? undefined : Number(e.target.value))
              }
              placeholder="No limit"
            />
          </div>
          <div className="properties-checkbox-row">
            <input
              id="prop-caption-required"
              type="checkbox"
              checked={field.props.captionRequired ?? false}
              onChange={(e) => updateProp("captionRequired", e.target.checked)}
            />
            <label htmlFor="prop-caption-required">Caption Required</label>
          </div>
        </>
      )}

      {/* ─── INSTRUCTIONS ─── */}
      {field.type === "INSTRUCTIONS" && (
        <div className="properties-field-group">
          <label htmlFor="prop-content">Content</label>
          <textarea
            id="prop-content"
            value={field.props.content ?? ""}
            onChange={(e) => updateProp("content", e.target.value || undefined)}
            placeholder="Read-only instructions shown to the technician"
            rows={4}
          />
        </div>
      )}
    </div>
  );
}
