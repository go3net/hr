/**
 * Client-side fetch wrapper. All requests go through the Next.js BFF layer
 * (/api/backend/*), which attaches the HttpOnly session token and forwards
 * to the Laravel API — the browser never holds the token and no CORS is
 * involved.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export type Envelope<T> = { data: T; meta?: { pagination?: { next_cursor: string | null; per_page: number } } };

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const { body, headers, ...rest } = options;

  const res = await fetch(`/api/backend${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }

  if (res.status === 204) return { data: undefined as T };

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const err = json?.error;
    const fields = json?.errors as Record<string, string[]> | undefined;
    const firstFieldError = fields ? Object.values(fields)[0]?.[0] : undefined;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? json?.message ?? firstFieldError ?? `Request failed (${res.status})`,
      err?.fields ?? fields,
    );
  }

  return json as Envelope<T>;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body });
export const destroy = <T>(path: string) => api<T>(path, { method: "DELETE" });
