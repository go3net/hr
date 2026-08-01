import { NextRequest, NextResponse } from "next/server";
import { API_URL, SESSION_COOKIE } from "@/lib/server/backend";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Email and password are required." } },
      { status: 422 },
    );
  }

  const upstream = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      device_name: "web",
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
    return NextResponse.json(json ?? { error: { code: "LOGIN_FAILED", message: "Login failed." } }, {
      status: upstream.status,
    });
  }

  // 2FA-enrolled users get a challenge instead of a session.
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
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return response;
}
