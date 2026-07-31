import { cookies } from "next/headers";

/**
 * Server-side helpers for the BFF layer. The browser never sees the API
 * token — it lives in an HttpOnly cookie and is attached here when route
 * handlers proxy requests to the Laravel API.
 */

export const API_URL = process.env.API_URL ?? "http://localhost:8000";
export const SESSION_COOKIE = "g3_session";

export async function sessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await sessionToken();

  return fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
}
