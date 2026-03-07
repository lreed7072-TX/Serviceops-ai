"use client";

import {
  Type,
  AlignLeft,
  Hash,
  ToggleLeft,
  ChevronDown,
  CheckSquare,
  Calendar,
  Camera,
  PenTool,
  MapPin,
  Heading,
  Info,
  Calculator,
} from "lucide-react";

interface AddFieldModalProps {
  onAdd: (type: string) => void;
  onClose: () => void;
}

interface FieldTypeOption {
  type: string;
  label: string;
  icon: React.ReactNode;
}

const INPUT_FIELDS: FieldTypeOption[] = [
  { type: "TEXT_INPUT", label: "Text Input", icon: <Type size={20} /> },
  { type: "TEXTAREA", label: "Long Text", icon: <AlignLeft size={20} /> },
  { type: "NUMERIC_INPUT", label: "Number", icon: <Hash size={20} /> },
  { type: "YES_NO", label: "Yes / No", icon: <ToggleLeft size={20} /> },
  { type: "DROPDOWN", label: "Dropdown", icon: <ChevronDown size={20} /> },
  { type: "MULTI_SELECT", label: "Multi-Select", icon: <CheckSquare size={20} /> },
  { type: "DATE_INPUT", label: "Date", icon: <Calendar size={20} /> },
];

const CAPTURE_FIELDS: FieldTypeOption[] = [
  { type: "PHOTO_CAPTURE", label: "Photo", icon: <Camera size={20} /> },
  { type: "SIGNATURE", label: "Signature", icon: <PenTool size={20} /> },
  { type: "GPS_CAPTURE", label: "GPS Location", icon: <MapPin size={20} /> },
];

const LAYOUT_FIELDS: FieldTypeOption[] = [
  { type: "SECTION_HEADER", label: "Section Header", icon: <Heading size={20} /> },
  { type: "INSTRUCTIONS", label: "Instructions", icon: <Info size={20} /> },
  { type: "CALCULATED", label: "Calculated", icon: <Calculator size={20} /> },
];

export default function AddFieldModal({ onAdd, onClose }: AddFieldModalProps) {
  const handleAdd = (type: string) => {
    onAdd(type);
    onClose();
  };

  return (
    <div className="add-field-modal-overlay" onClick={onClose}>
      <div className="add-field-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-field-modal-header">
          <h2>Add Field</h2>
          <button className="add-field-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="add-field-category">
          <h4>Input Fields</h4>
          <div className="field-type-grid">
            {INPUT_FIELDS.map((f) => (
              <button key={f.type} className="field-type-btn" onClick={() => handleAdd(f.type)}>
                <span className="field-type-btn-icon">{f.icon}</span>
                <span className="field-type-btn-label">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="add-field-category">
          <h4>Capture Fields</h4>
          <div className="field-type-grid">
            {CAPTURE_FIELDS.map((f) => (
              <button key={f.type} className="field-type-btn" onClick={() => handleAdd(f.type)}>
                <span className="field-type-btn-icon">{f.icon}</span>
                <span className="field-type-btn-label">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="add-field-category">
          <h4>Layout &amp; Computed</h4>
          <div className="field-type-grid">
            {LAYOUT_FIELDS.map((f) => (
              <button key={f.type} className="field-type-btn" onClick={() => handleAdd(f.type)}>
                <span className="field-type-btn-icon">{f.icon}</span>
                <span className="field-type-btn-label">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
