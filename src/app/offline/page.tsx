"use client";

import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.href = "/dashboard";
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="offline-page">
      <div className="offline-card">
        <div className="offline-icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>

        <h1 className="offline-title">You are offline</h1>

        <p className="offline-description">
          It looks like you have lost your internet connection. Some features may
          not be available until you reconnect.
        </p>

        {isOnline && (
          <p className="offline-reconnected">
            Connection restored. You can return to the app.
          </p>
        )}

        <button
          className="offline-retry-btn"
          onClick={handleRetry}
        >
          {isOnline ? "Return to Dashboard" : "Try Again"}
        </button>

        <p className="offline-hint">
          Any changes you made while offline will be synced automatically when
          your connection is restored.
        </p>
      </div>
    </div>
  );
}
