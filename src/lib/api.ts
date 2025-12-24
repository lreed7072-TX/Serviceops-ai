import { getDevAuthHeaders } from "./dev-auth";

type DevAuthHeaders = Record<"x-org-id" | "x-user-id" | "x-role", string>;

const DEV_SESSION_STORAGE_KEY = "devAuth";
const isProduction = process.env.NODE_ENV === "production";

const sessionToHeaders = (session: {
  orgId?: string;
  userId?: string;
  role?: string;
}): DevAuthHeaders | null => {
  if (!session.orgId || !session.userId || !session.role) {
    return null;
  }

  return {
    "x-org-id": session.orgId,
    "x-user-id": session.userId,
    "x-role": session.role,
  };
};

const getDevSessionFromEnv = (): DevAuthHeaders | null => {
  if (isProduction) return null;

  return sessionToHeaders({
    orgId: process.env.NEXT_PUBLIC_DEV_ORG_ID ?? "",
    userId: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "",
    role: process.env.NEXT_PUBLIC_DEV_ROLE ?? "",
  });
};

const getDevSessionFromStorage = (): DevAuthHeaders | null => {
  if (isProduction || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(DEV_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      orgId?: string;
      userId?: string;
      role?: string;
    };

    return sessionToHeaders(parsed);
  } catch (error) {
    console.warn("Unable to read dev auth session from localStorage.", error);
    return null;
  }
};

const getRequiredDevAuthHeaders = (): DevAuthHeaders | null =>
  getDevSessionFromEnv() ?? getDevSessionFromStorage();

export type ApiFetchOptions = RequestInit & {
  /**
   * Set to true to opt out of automatically attaching dev bypass headers.
   */
  skipDevAuthHeaders?: boolean;
};

export async function apiFetch(
  input: RequestInfo | URL,
  init: ApiFetchOptions = {}
): Promise<Response> {
  const { skipDevAuthHeaders, headers, ...rest } = init;
  const requestHeaders = new Headers(headers ?? {});
  const devHeaders = !skipDevAuthHeaders
    ? getDevAuthHeaders() ?? getRequiredDevAuthHeaders()
    : null;

  if (devHeaders) {
    for (const [key, value] of Object.entries(devHeaders)) {
      requestHeaders.set(key, value);
    }
  }

  return fetch(input, { ...rest, headers: requestHeaders });
}
