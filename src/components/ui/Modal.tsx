"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import "./shared-ui.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeable?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeable = true,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeable) onClose();
    },
    [onClose, closeable]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div
      className="ui-modal-overlay"
      onClick={closeable ? onClose : undefined}
    >
      <div
        className={`ui-modal ui-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal-header">
          <h3 className="ui-modal-title">{title}</h3>
          {closeable && (
            <button className="ui-modal-close" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
