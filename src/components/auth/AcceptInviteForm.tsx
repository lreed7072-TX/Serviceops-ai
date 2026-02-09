"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AcceptInviteFormProps {
  email: string;
  name: string;
  token: string;
  orgName: string;
}

const hasSupabaseEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function AcceptInviteForm({
  email,
  name,
  token,
  orgName,
}: AcceptInviteFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [status, setStatus] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match");
      return;
    }

    setAccepting(true);
    setStatus("Creating your account...");

    try {
      if (hasSupabaseEnv) {
        // Create Supabase auth account
        const supabase = createSupabaseBrowserClient();
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        });

        if (signUpError) {
          throw new Error(signUpError.message);
        }
      }

      // Mark invite as accepted and activate user
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invitation");
      }

      setStatus("Account created! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Failed to create account");
      setAccepting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: "16px" }}>
        <label htmlFor="invite-email">Email</label>
        <input id="invite-email" type="email" value={email} disabled />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label htmlFor="invite-name">Full Name</label>
        <input id="invite-name" type="text" value={name} disabled />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label htmlFor="invite-password">Create Password</label>
        <input
          id="invite-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          minLength={8}
          required
          disabled={accepting}
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label htmlFor="invite-confirm">Confirm Password</label>
        <input
          id="invite-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter password"
          required
          disabled={accepting}
        />
      </div>

      <button type="submit" disabled={accepting}>
        {accepting ? "Creating Account..." : "Accept Invitation"}
      </button>

      {status && (
        <p style={{ marginTop: "12px", opacity: 0.9 }}>{status}</p>
      )}

      <p style={{ marginTop: "16px", fontSize: "13px", color: "#6b7280" }}>
        By accepting, you&apos;ll join <strong>{orgName}</strong> on ServiceOpsIQ.
      </p>
    </form>
  );
}
