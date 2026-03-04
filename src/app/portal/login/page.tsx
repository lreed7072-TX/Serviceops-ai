"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PortalLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill token from URL query param
  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      handleLogin(urlToken);
    }
  }, [searchParams]);

  const handleLogin = async (tokenValue?: string) => {
    const t = tokenValue || token;
    if (!t.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid token. Please try again.");
        return;
      }

      router.push("/portal");
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <div className="portal-login-page">
      <div className="portal-login-card">
        <h1 className="portal-login-title">Customer Portal</h1>
        <p className="portal-login-subtitle">
          Enter your access token to view your quotes, invoices, and work orders.
        </p>

        {error && <div className="portal-login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="portal-form-field">
            <label className="portal-form-label">Access Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="portal-form-input"
              placeholder="Enter your portal access token"
              autoFocus
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="portal-login-btn"
            disabled={loading || !token.trim()}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div className="portal-login-page"><div className="portal-login-card"><p>Loading...</p></div></div>}>
      <PortalLoginContent />
    </Suspense>
  );
}
