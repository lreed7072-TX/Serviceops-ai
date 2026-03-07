"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error?.message, error?.stack);
  }, [error]);

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ color: "#ef4444" }}>Page Error</h2>
      <p style={{ color: "#666" }}>
        An error occurred while loading this page.
      </p>
      <details
        open
        style={{
          background: "#fef2f2",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
          border: "1px solid #fee2e2",
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
          Error Details
        </summary>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: "0.85rem",
            marginTop: "0.5rem",
          }}
        >
          {error?.message}
          {"\n\n"}
          {error?.digest ? `Digest: ${error.digest}` : ""}
          {"\n\n"}
          {error?.stack}
        </pre>
      </details>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            cursor: "pointer",
            borderRadius: "4px",
            border: "1px solid #ccc",
            background: "#f97316",
            color: "#fff",
          }}
        >
          Try Again
        </button>
        <button
          onClick={() => (window.location.href = "/dashboard")}
          style={{
            padding: "0.5rem 1rem",
            cursor: "pointer",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
