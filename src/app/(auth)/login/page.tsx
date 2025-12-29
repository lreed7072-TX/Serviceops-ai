"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { setDevAuthSession } from "@/lib/dev-auth";

const devSessionDefaults = {
  orgId:
    process.env.NEXT_PUBLIC_DEV_ORG_ID ??
    "951acf8a-bd4d-411c-abd1-f8127843c44c",
  userId:
    process.env.NEXT_PUBLIC_DEV_USER_ID ??
    "97e3da36-9ec7-4aca-982e-d252ee205a48",
  role: process.env.NEXT_PUBLIC_DEV_ROLE ?? "ADMIN",
};

// Show dev session button only when explicitly enabled for Preview/dev
const canUseDevSession = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

// IMPORTANT: don't throw during prerender/build — just disable login UI if not configured
const hasSupabaseEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasSupabaseEnv) {
      setStatus("Supabase auth is not configured for this deployment.");
      return;
    }

    setStatus("Signing in...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Signed in. Redirecting...");
      router.push("/work-orders");
      router.refresh();
    } catch (err) {
      setStatus("Login failed (Supabase client init error).");
      console.error(err);
    }
  };


  const handleGoogleLogin = async () => {
    if (!hasSupabaseEnv) {
      setStatus("Supabase auth is not configured for this deployment.");
      return;
    }

    setStatus("Redirecting to Google...");

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        setStatus(error.message);
      }
    } catch (err) {
      setStatus("OAuth login failed (Supabase client init error).");
      console.error(err);
    }
  };

  const handleDevLogin = () => {
    if (!canUseDevSession) return;
    setDevAuthSession(devSessionDefaults);
    router.push("/work-orders");
  };

  return (
    <div className="login-card">
      <span className="badge">Invite-only</span>
      <h2>Sign in</h2>
      <p>Sign in with your Supabase account.</p>


      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={!hasSupabaseEnv}
        style={{ marginBottom: 12 }}
      >
        Continue with Google
      </button>

      <form onSubmit={handleLogin}>
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={!hasSupabaseEnv}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={!hasSupabaseEnv}
        />

        <button type="submit" disabled={!hasSupabaseEnv}>
          Sign in
        </button>
      </form>

      {status ? <p style={{ marginTop: 12, opacity: 0.9 }}>{status}</p> : null}

      {canUseDevSession && (
        <button
          type="button"
          className="dev-session-button"
          onClick={handleDevLogin}
          style={{ marginTop: 12 }}
        >
          Use Dev Session
        </button>
      )}
    </div>
  );
}
