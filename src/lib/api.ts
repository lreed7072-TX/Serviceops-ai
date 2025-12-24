import { getDevAuthHeaders } from "./dev-auth";

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
  const devHeaders = !skipDevAuthHeaders ? getDevAuthHeaders() : null;

  if (devHeaders) {
    for (const [key, value] of Object.entries(devHeaders)) {
      requestHeaders.set(key, value);
    }
  }

  return fetch(input, { ...rest, headers: requestHeaders });
}
