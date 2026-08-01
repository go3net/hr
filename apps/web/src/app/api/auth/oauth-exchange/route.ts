import { NextRequest, NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/server/backend";

/** Swaps the one-time OAuth code for a session cookie (or a 2FA challenge). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const upstream = await fetch(`${API_URL}/api/v1/auth/oauth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code: body?.code }),
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
    return NextResponse.json(json ?? { error: { code: "EXCHANGE_FAILED", message: "Sign-in failed." } }, {
      status: upstream.status,
    });
  }

  if (json.data.two_factor_required) {
    return NextResponse.json({
      data: { two_factor_required: true, challenge_token: json.data.challenge_token },
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
