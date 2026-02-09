"use client";

import "./AdvancedFilterPanel.css";

type ExportButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

export default function ExportButton({ onClick, disabled, label = "Export CSV" }: ExportButtonProps) {
  return (
    <button className="afp-export-btn" onClick={onClick} disabled={disabled}>
      <span className="afp-export-icon">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <path
            d="M3 17h14M10 3v11m0 0l-4-4m4 4l4-4"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {label}
    </button>
  );
}
