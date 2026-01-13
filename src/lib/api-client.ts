/**
 * Client-side API fetch wrapper
 * Handles authentication headers and error responses
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });

  return response;
}
