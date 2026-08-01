import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/server/backend";

/** Kicks off OAuth: fetches the provider authorization URL and redirects. */
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;

  const upstream = await fetch(`${API_URL}/api/v1/auth/oauth/${provider}/redirect`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);

  const json = await upstream?.json().catch(() => null);

  if (!upstream?.ok || !json?.data?.url) {
    return NextResponse.redirect(new URL("/login?oauth_error=provider_failed", request.url));
  }

  return NextResponse.redirect(json.data.url);
}
