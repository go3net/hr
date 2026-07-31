import { NextResponse } from "next/server";
import { backendFetch, SESSION_COOKIE } from "@/lib/server/backend";

export async function POST() {
  // Best effort — revoke the token server-side, then drop the cookie.
  await backendFetch("/auth/logout", { method: "POST" }).catch(() => null);

  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });

  return response;
}
