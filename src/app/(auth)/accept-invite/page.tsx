"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import AcceptInviteForm from "@/components/auth/AcceptInviteForm";

interface InviteData {
  email: string;
  name: string;
  role: string;
  orgName: string;
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteData | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token");
      setLoading(false);
      return;
    }

    const validate = async () => {
      try {
        const res = await fetch(`/api/auth/validate-invite?token=${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Invalid invitation");
        }
        const json = await res.json();
        setInvite(json.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Invalid invitation");
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, [token]);

  if (loading) {
    return (
      <div className="login-card">
        <h2>Validating Invitation...</h2>
        <p>Please wait while we verify your invitation.</p>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="login-card">
        <h2>Invalid Invitation</h2>
        <p style={{ color: "#dc2626", marginBottom: "16px" }}>
          {error || "This invitation is no longer valid."}
        </p>
        <a href="/login" className="btn btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
          Go to Login
        </a>
      </div>
    );
  }

  return (
    <div className="login-card">
      <h2>Accept Invitation</h2>
      <p style={{ marginBottom: "24px" }}>
        You&apos;ve been invited to join <strong>{invite.orgName}</strong> as a{" "}
        <strong>{invite.role}</strong>.
      </p>

      <AcceptInviteForm
        email={invite.email}
        name={invite.name}
        token={token!}
        orgName={invite.orgName}
      />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="login-card">
          <h2>Loading...</h2>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
