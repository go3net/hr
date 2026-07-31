import { NextRequest, NextResponse } from "next/server";
import { API_URL, sessionToken } from "@/lib/server/backend";

/**
 * Private-channel auth for the WebSocket client. Echo posts
 * socket_id + channel_name here; we attach the HttpOnly session token
 * and let Laravel's channel callbacks decide membership.
 */
export async function POST(request: NextRequest) {
  const token = await sessionToken();
  if (!token) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }

  const body = await request.arrayBuffer();
  const response = await fetch(`${API_URL}/api/broadcasting/auth`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);
  return NextResponse.json(json ?? {}, { status: response.status });
}
