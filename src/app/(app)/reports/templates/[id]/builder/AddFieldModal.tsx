"use client";

interface AddFieldModalProps {
  onAdd: (type: string) => void;
  onClose: () => void;
}

interface FieldTypeOption {
  type: string;
  label: string;
  icon: string;
}

const INPUT_FIELDS: FieldTypeOption[] = [
  { type: "TEXT_INPUT", label: "Text Input", icon: "Aa" },
  { type: "TEXTAREA", label: "Long Text", icon: "\u00b6" },
  { type: "NUMERIC_INPUT", label: "Number", icon: "#" },
  { type: "YES_NO", label: "Yes / No", icon: "\u2713\u2717" },
  { type: "DROPDOWN", label: "Dropdown", icon: "\u25BE" },
  { type: "MULTI_SELECT", label: "Multi-Select", icon: "\u2611" },
  { type: "DATE_INPUT", label: "Date", icon: "\uD83D\uDCC5" },
];

const CAPTURE_FIELDS: FieldTypeOption[] = [
  { type: "PHOTO_CAPTURE", label: "Photo", icon: "\uD83D\uDCF7" },
  { type: "SIGNATURE", label: "Signature", icon: "\u270D" },
  { type: "GPS_CAPTURE", label: "GPS Location", icon: "\uD83D\uDCCD" },
];

const LAYOUT_FIELDS: FieldTypeOption[] = [
  { type: "SECTION_HEADER", label: "Section Header", icon: "\u2014" },
  { type: "INSTRUCTIONS", label: "Instructions", icon: "\u2139" },
  { type: "CALCULATED", label: "Calculated", icon: "fx" },
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
