const isProduction = process.env.NODE_ENV === "production";

export type DevAuthSession = {
  orgId: string;
  userId: string;
  role: string;
};

type DevAuthHeaders = Record<"x-org-id" | "x-user-id" | "x-role", string>;

const DEV_SESSION_STORAGE_KEY = "devAuth";

const truthy = (value?: string | null): boolean =>
  typeof value === "string" && value.toLowerCase() === "true";

const rawBypassFlag =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS ??
  process.env.DEV_AUTH_BYPASS ??
  "";

const devBypassEnabled = !isProduction && truthy(rawBypassFlag);

const envSession: DevAuthSession | null = (() => {
  if (!devBypassEnabled) return null;

  const orgId =
    process.env.NEXT_PUBLIC_DEV_ORG_ID ??
    process.env.DEV_ORG_ID ??
    "";
  const userId =
    process.env.NEXT_PUBLIC_DEV_USER_ID ??
    process.env.DEV_USER_ID ??
    "";
  const role =
    process.env.NEXT_PUBLIC_DEV_ROLE ??
    process.env.DEV_ROLE ??
    "";

  if (orgId && userId && role) {
    return { orgId, userId, role };
  }

  return null;
})();

const sessionToHeaders = (session: DevAuthSession): DevAuthHeaders => ({
  "x-org-id": session.orgId,
  "x-user-id": session.userId,
  "x-role": session.role,
});

const readStoredSession = (): DevAuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DEV_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<DevAuthSession>;
    if (
      parsed &&
      typeof parsed.orgId === "string" &&
      typeof parsed.userId === "string" &&
      typeof parsed.role === "string"
    ) {
      return {
        orgId: parsed.orgId,
        userId: parsed.userId,
        role: parsed.role,
      };
    }
  } catch (error) {
    console.warn("Unable to parse dev auth session from localStorage.", error);
  }

  return null;
};

export function getDevAuthHeaders(): DevAuthHeaders | null {
  if (!devBypassEnabled) {
    return null;
  }

  if (envSession) {
    return sessionToHeaders(envSession);
  }

  const stored = readStoredSession();
  return stored ? sessionToHeaders(stored) : null;
}

export function isDevAuthBypassEnabled(): boolean {
  return devBypassEnabled;
}

export function setDevAuthSession(session: DevAuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      DEV_SESSION_STORAGE_KEY,
      JSON.stringify(session)
    );
  } catch (error) {
    console.warn("Unable to persist dev auth session.", error);
  }
}
