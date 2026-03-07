"use client";

import "./shared-ui.css";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
}

export function LoadingSpinner({ message, size = "md", inline = false }: LoadingSpinnerProps) {
  if (inline) {
    return <span className={`ui-spinner ui-spinner--${size}`} />;
  }

  return (
    <div className="ui-loading-container">
      <div className={`ui-spinner ui-spinner--${size}`} />
      {message && <p className="ui-loading-text">{message}</p>}
    </div>
  );
}
