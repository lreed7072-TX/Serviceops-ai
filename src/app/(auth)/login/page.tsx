"use client";

import { useRouter } from "next/navigation";
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

const isProduction = process.env.NODE_ENV === "production";
const canUseDevSession =
  !isProduction &&
  devSessionDefaults.orgId &&
  devSessionDefaults.userId &&
  devSessionDefaults.role;

export default function LoginPage() {
  const router = useRouter();

  const handleDevLogin = () => {
    if (!canUseDevSession) return;
    setDevAuthSession(devSessionDefaults);
    router.push("/work-orders");
  };

  return (
    <div className="login-card">
      <span className="badge">Invite-only</span>
      <h2>Sign in</h2>
      <p>Use your invite-issued account and org context to access the platform.</p>
      <form>
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" placeholder="you@company.com" />
        <label htmlFor="org">Org ID</label>
        <input id="org" name="org" placeholder="org_123" />
        <button type="button">Request access</button>
      </form>
      {canUseDevSession && (
        <button type="button" className="dev-session-button" onClick={handleDevLogin}>
          Use Dev Session
        </button>
      )}
    </div>
  );
}
