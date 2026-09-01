import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/server/backend";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.email) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Enter your work email address." } },
      { status: 422 },
    );
  }

  const upstream = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: body.email }),
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: { code: "API_UNREACHABLE", message: "Could not reach the Go3net Office API." } },
      { status: 502 },
    );
  }

  const json = await upstream.json().catch(() => null);
  return NextResponse.json(json ?? { error: { code: "RESET_REQUEST_FAILED", message: "Could not request a reset link." } }, {
    status: upstream.status,
  });
}
