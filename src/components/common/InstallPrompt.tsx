"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "serviceopsiq-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(DISMISS_KEY);
  if (!val) return false;
  const ts = parseInt(val, 10);
  if (Date.now() - ts < DISMISS_DURATION_MS) return true;
  localStorage.removeItem(DISMISS_KEY);
  return false;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    if (isIOS()) {
      // Show iOS instructions after a short delay
      const timer = setTimeout(() => {
        setShowIOSPrompt(true);
        setVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Android/desktop Chrome: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <img
          src="/icons/icon-192.png"
          alt="ServiceOpsIQ"
          className="install-prompt-icon"
          width={40}
          height={40}
        />
        <div className="install-prompt-text">
          {showIOSPrompt ? (
            <>
              <strong>Install ServiceOpsIQ</strong>
              <span>
                Tap{" "}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ verticalAlign: "middle" }}
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>{" "}
                then &quot;Add to Home Screen&quot;
              </span>
            </>
          ) : (
            <>
              <strong>Install ServiceOpsIQ</strong>
              <span>Add to your home screen for quick access</span>
            </>
          )}
        </div>
        <div className="install-prompt-actions">
          {!showIOSPrompt && (
            <button
              className="install-prompt-btn install-prompt-btn-primary"
              onClick={handleInstall}
            >
              Install
            </button>
          )}
          <button
            className="install-prompt-btn install-prompt-btn-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
          >
            {showIOSPrompt ? "Got it" : "Not now"}
          </button>
        </div>
      </div>
    </div>
  );
}
