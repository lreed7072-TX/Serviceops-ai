"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Signing in...");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Signed in. Refreshing...");
    window.location.href = "/dashboard";
  }

  async function onLogout() {
    setStatus("Signing out...");
    await supabase.auth.signOut();
    setStatus("Signed out.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Login</h1>

      <form onSubmit={onLogin} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
            style={{ padding: 10, border: "1px solid #333", borderRadius: 8 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            style={{ padding: 10, border: "1px solid #333", borderRadius: 8 }}
          />
        </label>

        <button
          type="submit"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #333", cursor: "pointer" }}
        >
          Sign in
        </button>

        <button
          type="button"
          onClick={onLogout}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #333", cursor: "pointer" }}
        >
          Sign out
        </button>

        {status ? <pre style={{ whiteSpace: "pre-wrap" }}>{status}</pre> : null}
      </form>
    </main>
  );
}
