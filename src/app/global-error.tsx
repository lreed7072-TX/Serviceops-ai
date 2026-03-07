"use client";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error:", error?.message, error?.stack);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h2>Something went wrong</h2>
        <p style={{ color: "#666" }}>A global error occurred. This usually indicates an issue with the app layout or configuration.</p>
        <details open style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold" }}>Error Details</summary>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            {error?.message}{"\n\n"}{error?.stack}
          </pre>
        </details>
        <button
          onClick={reset}
          style={{ padding: "0.5rem 1rem", cursor: "pointer", borderRadius: "4px", border: "1px solid #ccc" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
