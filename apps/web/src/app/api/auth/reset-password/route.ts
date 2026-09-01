import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/server/backend";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.email || !body?.token || !body?.password || !body?.password_confirmation) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Complete every password-reset field." } },
      { status: 422 },
    );
  }

  const upstream = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: body.email,
      token: body.token,
      password: body.password,
      password_confirmation: body.password_confirmation,
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
  return NextResponse.json(json ?? { error: { code: "PASSWORD_RESET_FAILED", message: "Could not reset your password." } }, {
    status: upstream.status,
  });
}
