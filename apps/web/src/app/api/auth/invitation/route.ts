import { NextRequest, NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/server/backend";

/** Peek at an invitation so the setup page can greet the invitee. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const upstream = await fetch(
    `${API_URL}/api/v1/auth/invitation?token=${encodeURIComponent(token)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  ).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: { code: "API_UNREACHABLE", message: "Could not reach the Go3net Office API." } },
      { status: 502 },
    );
  }

  const json = await upstream.json().catch(() => null);
  return NextResponse.json(json ?? {}, { status: upstream.status });
}

/** Accept: set the password, then start a session right away. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const upstream = await fetch(`${API_URL}/api/v1/auth/invitation/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      token: body?.token,
      password: body?.password,
      password_confirmation: body?.password_confirmation,
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
    return NextResponse.json(json ?? { error: { code: "INVITE_FAILED", message: "Could not accept the invitation." } }, {
      status: upstream.status,
    });
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
