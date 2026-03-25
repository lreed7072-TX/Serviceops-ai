"use client";

import { useEffect, useState, useCallback } from "react";

export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const handleUpdate = useCallback(() => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage("SKIP_WAITING");
    }
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[PWA] Service worker registered:", registration.scope);

        // Detect new service worker waiting to activate
        if (registration.waiting) {
          setUpdateAvailable(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateAvailable(true);
            }
          });
        });

        // Check for updates periodically (every 60 minutes)
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error("[PWA] Service worker registration failed:", error);
      });

    // Handle controller change (after skipWaiting)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Reload is already triggered by handleUpdate
    });
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="sw-update-banner">
      <span>A new version of ServiceOpsIQ is available.</span>
      <button className="sw-update-btn" onClick={handleUpdate}>
        Update now
      </button>
    </div>
  );
}
