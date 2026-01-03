"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [orgName, setOrgName] = useState("Organization");

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setErr(null);
        setMsg(null);

        if (!token) throw new Error("Missing invite token.");

        const res = await fetch("/api/invites/lookup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Invite lookup failed (${res.status})`);
        }

        const json = await res.json();
        if (cancelled) return;
        setInviteEmail(String(json?.data?.email ?? ""));
        setOrgName(String(json?.data?.orgName ?? "Organization"));
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load invite.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setErr(null);
    setMsg(null);

    if (!token) return setErr("Missing invite token.");
    if (!inviteEmail) return setErr("Invite email missing.");
    if (!password || password.length < 8) return setErr("Password must be at least 8 characters.");
    if (password !== password2) return setErr("Passwords do not match.");

    setBusy(true);
    try {
      setMsg("Creating account and accepting invite…");

      // 1) Create/Update user + accept invite on server (no prior login required)
      const res = await fetch("/api/invites/accept-with-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Accept failed (${res.status})`);
      }

      // 2) Sign in so cookies/session are established
      const { error } = await supabase.auth.signInWithPassword({
        email: inviteEmail,
        password,
      });
      if (error) throw error;

      setMsg("✅ Invite accepted. Redirecting…");
      router.replace("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to accept invite.");
      setMsg(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Accept invite"
        subtitle="Set a password and join the organization."
        badge={<Badge>Invite</Badge>}
        right={
          <Button variant="secondary" type="button" onClick={() => router.push("/login")}>
            Use existing login
          </Button>
        }
      />

      {err ? <div className="page-alert error">Error: {err}</div> : null}
      {msg ? <div className="page-alert info">{msg}</div> : null}

      <div className="card">
        <h3>Join {orgName}</h3>

        {loading ? (
          <p>Loading invite…</p>
        ) : !token ? (
          <p className="muted">Missing token.</p>
        ) : (
          <form onSubmit={onAccept} style={{ display: "grid", gap: 12 }}>
            <label className="form-field" style={{ margin: 0 }}>
              <span>Email</span>
              <input value={inviteEmail} disabled />
            </label>

            <label className="form-field" style={{ margin: 0 }}>
              <span>Set password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={busy}
              />
            </label>

            <label className="form-field" style={{ margin: 0 }}>
              <span>Confirm password</span>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Re-enter password"
                disabled={busy}
              />
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button variant="primary" type="submit" disabled={busy || !inviteEmail}>
                {busy ? "Working…" : "Set password + Accept"}
              </Button>
            </div>

            <p className="muted" style={{ margin: 0 }}>
              If this email already has an account, use “Use existing login” and then accept again.
            </p>
          </form>
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
