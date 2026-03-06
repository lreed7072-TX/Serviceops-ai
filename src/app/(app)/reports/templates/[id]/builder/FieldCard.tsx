"use client";

import type { TemplateField } from "./types";
import type { DragEvent } from "react";

const INPUT_TYPES = new Set([
  "TEXT_INPUT", "TEXTAREA", "NUMERIC_INPUT", "YES_NO",
  "DROPDOWN", "MULTI_SELECT", "DATE_INPUT",
]);
const CAPTURE_TYPES = new Set(["PHOTO_CAPTURE", "SIGNATURE", "GPS_CAPTURE"]);
const LAYOUT_TYPES = new Set(["SECTION_HEADER", "INSTRUCTIONS"]);

function getTypeBadgeClass(type: string): string {
  if (INPUT_TYPES.has(type)) return "field-card-type-badge input";
  if (CAPTURE_TYPES.has(type)) return "field-card-type-badge capture";
  if (LAYOUT_TYPES.has(type)) return "field-card-type-badge layout";
  return "field-card-type-badge computed";
}

const TYPE_LABELS: Record<string, string> = {
  TEXT_INPUT: "Text",
  TEXTAREA: "Long Text",
  NUMERIC_INPUT: "Number",
  YES_NO: "Yes/No",
  DROPDOWN: "Dropdown",
  MULTI_SELECT: "Multi-Select",
  DATE_INPUT: "Date",
  PHOTO_CAPTURE: "Photo",
  SIGNATURE: "Signature",
  GPS_CAPTURE: "GPS",
  SECTION_HEADER: "Section",
  INSTRUCTIONS: "Instructions",
  CALCULATED: "Calculated",
};

function getFieldPropsSummary(field: TemplateField): string[] {
  const tags: string[] = [];
  const { props, type } = field;

  if (props.required) tags.push("Required");

  if (type === "NUMERIC_INPUT") {
    const parts: string[] = [];
    if (props.minValue !== undefined) parts.push(String(props.minValue));
    if (props.maxValue !== undefined) parts.push(String(props.maxValue));
    if (parts.length > 0) {
      const range = parts.join("–");
      tags.push(props.unit ? `${range} ${props.unit}` : range);
    } else if (props.unit) {
      tags.push(props.unit);
    }
  }

  if ((type === "DROPDOWN" || type === "MULTI_SELECT") && props.options) {
    tags.push(`${props.options.length} option${props.options.length !== 1 ? "s" : ""}`);
  }

  if (type === "PHOTO_CAPTURE" && props.maxPhotos) {
    tags.push(`Max ${props.maxPhotos} photo${props.maxPhotos !== 1 ? "s" : ""}`);
  }

  if (type === "CALCULATED" && props.formula) {
    tags.push(props.formula);
  }

  return tags;
}

interface FieldCardProps {
  field: TemplateField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
}

export default function FieldCard({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: FieldCardProps) {
  const tags = getFieldPropsSummary(field);

  let className = "field-card";
  if (isSelected) className += " field-card--selected";

  return (
    <div
      className={className}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="field-card-drag-handle" title="Drag to reorder">&#x2261;</span>
      <div className="field-card-content">
        <div className="field-card-top-row">
          <span className={getTypeBadgeClass(field.type)}>
            {TYPE_LABELS[field.type] ?? field.type}
          </span>
          <span className="field-card-title">{field.title || "Untitled"}</span>
        </div>
        {tags.length > 0 && (
          <div className="field-card-props">
            {tags.map((tag) => (
              <span key={tag} className="field-card-prop-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <button
        className="field-card-delete-btn"
        title="Delete field"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        &times;
      </button>
    </div>
  );
}
