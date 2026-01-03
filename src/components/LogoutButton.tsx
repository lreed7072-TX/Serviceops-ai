"use client";

import { useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <button type="button" className="link-button" onClick={onLogout} disabled={busy}>
      {busy ? "Logging out…" : "Logout"}
    </button>
  );
}
