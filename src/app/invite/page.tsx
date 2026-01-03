"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function InviteInner() {
  const params = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => params.get("token") ?? "", [params]);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const acceptInvite = async () => {
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Accept failed (${res.status})`);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErr("Missing invite token.");
      return;
    }

    const eMail = email.trim();
    if (!eMail) {
      setErr("Email is required.");
      return;
    }
    if (!password || password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      if (mode === "signup") {
        // If email confirmations are OFF, this returns a session immediately.
        const { error } = await supabase.auth.signUp({
          email: eMail,
          password,
        });
        if (error) throw error;
        setMsg("Account created. Accepting invite…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: eMail,
          password,
        });
        if (error) throw error;
        setMsg("Signed in. Accepting invite…");
      }

      await acceptInvite();

      setMsg("✅ Invite accepted. Redirecting…");
      router.replace("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Accept invite"
        subtitle="Create an account or sign in, then join the organization."
        badge={<Badge>Invite</Badge>}
        right={
          <Button variant="secondary" type="button" onClick={() => router.push("/login")}>
            Use Google login
          </Button>
        }
      />

      {err ? <div className="page-alert error">Error: {err}</div> : null}
      {msg ? <div className="page-alert info">{msg}</div> : null}

      <div className="card">
        <h3>Join organization</h3>

        {!token ? (
          <p className="muted">This invite link is missing a token.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <Button
                variant={mode === "signup" ? "primary" : "secondary"}
                type="button"
                onClick={() => setMode("signup")}
                disabled={busy}
              >
                Create account
              </Button>
              <Button
                variant={mode === "signin" ? "primary" : "secondary"}
                type="button"
                onClick={() => setMode("signin")}
                disabled={busy}
              >
                Sign in
              </Button>
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <label className="form-field" style={{ margin: 0 }}>
                <span>Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={busy}
                />
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  disabled={busy}
                />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Button variant="primary" type="submit" disabled={busy}>
                  {busy ? "Working…" : mode === "signup" ? "Create + Accept" : "Sign in + Accept"}
                </Button>
              </div>

              <p className="muted" style={{ margin: 0 }}>
                This flow supports any email domain. Google login is optional.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<div className="page-alert info">Loading invite…</div>}>
      <InviteInner />
    </Suspense>
  );
}
