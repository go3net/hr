import { NextRequest, NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/server/backend";

/** Create a workspace, then sign the founder straight in. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const upstream = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      company: body?.company,
      subdomain: body?.subdomain,
      name: body?.name,
      email: body?.email,
      password: body?.password,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: { code: "API_UNREACHABLE", message: "Could not reach the Go3net Office API." } },
      { status: 502 },
    );
  }

  const json = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      json ?? { error: { code: "REGISTER_FAILED", message: "Could not create the workspace." } },
      { status: upstream.status },
    );
  }

  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, json.data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
