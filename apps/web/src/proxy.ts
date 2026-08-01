import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "g3_session";
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

/**
 * Route guard (Next 16 proxy — the successor to middleware.ts).
 * Signed-out users are sent to /login; signed-in users skip auth pages.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\.(?:svg|png|jpg|ico)).*)"],
};
