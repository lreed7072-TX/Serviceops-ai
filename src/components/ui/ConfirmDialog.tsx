"use client";

import { Modal } from "./Modal";
import "./shared-ui.css";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" closeable={!loading}>
      <div className="ui-confirm-body">
        {variant === "danger" && (
          <div className="ui-confirm-icon ui-confirm-icon--danger">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        )}
        {variant === "warning" && (
          <div className="ui-confirm-icon ui-confirm-icon--warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        )}
        <p className="ui-confirm-message">{message}</p>
        {detail && <p className="ui-confirm-detail">{detail}</p>}
      </div>
      <div className="ui-confirm-actions">
        <button
          className="ui-btn ui-btn--secondary"
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </button>
        <button
          className={`ui-btn ui-btn--${variant === "danger" ? "danger" : "primary"}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Processing..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
