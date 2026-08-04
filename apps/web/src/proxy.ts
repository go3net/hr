import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "g3_session";
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/accept-invite"];

/**
 * Reachable whether or not you are signed in. An invitation activates a
 * specific account, so bouncing a visitor who happens to hold a session to
 * the dashboard strands them: a shared or previously-used phone, or HR
 * opening the link to check it, and the setup page can never be reached.
 * The token identifies the account, not the cookie.
 */
const ALWAYS_REACHABLE = ["/accept-invite"];

/**
 * Route guard (Next 16 proxy — the successor to middleware.ts).
 * Signed-out users are sent to /login; signed-in users skip auth pages.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const alwaysReachable = ALWAYS_REACHABLE.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (hasSession && isPublic && !alwaysReachable) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\.(?:svg|png|jpg|ico)).*)"],
};
