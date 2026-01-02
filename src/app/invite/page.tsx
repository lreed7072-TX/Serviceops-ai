"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function InviteInner() {
  const params = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [status, setStatus] = useState<"idle" | "accepting" | "accepted" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    if (!token) {
      setStatus("error");
      setErr("Missing invite token.");
      return;
    }
    setStatus("idle");
  }, [token]);

  const accept = async () => {
    if (!token || status === "accepting") return;
    setStatus("accepting");
    setErr(null);

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Accept failed (${res.status})`);
      }

      setStatus("accepted");
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message ?? "Failed to accept invite.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Accept invite"
        subtitle="Join the organization to access ServiceOps AI."
        badge={<Badge>Invite</Badge>}
      />

      {err ? <div className="page-alert error">Error: {err}</div> : null}

      <div className="card">
        <h3>Invite</h3>
        {!token ? (
          <p className="muted">This invite link is missing a token.</p>
        ) : status === "accepted" ? (
          <>
            <p>✅ Invite accepted.</p>
            <p className="muted">Next, log in to start using the app.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="primary" type="button" onClick={() => router.push("/login")}>
                Go to login
              </Button>
              <Button variant="secondary" type="button" onClick={() => router.push("/")}>
                Home
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ wordBreak: "break-all" }}>
              Token: {token}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                variant="primary"
                type="button"
                onClick={accept}
                disabled={status === "accepting"}
              >
                {status === "accepting" ? "Accepting…" : "Accept invite"}
              </Button>
              <Button variant="secondary" type="button" onClick={() => router.push("/login")}>
                Login first
              </Button>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              If you already have an account, you can log in first, then return and accept.
            </p>
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
