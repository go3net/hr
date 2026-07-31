import { NextRequest, NextResponse } from "next/server";
import { backendFetch, sessionToken } from "@/lib/server/backend";

/**
 * Catch-all proxy: the browser calls /api/backend/<path> and this handler
 * forwards it to the Laravel API with the session's bearer token. Keeps
 * the token out of the browser entirely and avoids CORS.
 */

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (!(await sessionToken())) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const search = request.nextUrl.search;
  const target = `/${path.join("/")}${search}`;

  const hasBody = request.method !== "GET" && request.method !== "DELETE";
  const body = hasBody ? await request.text() : undefined;

  const upstream = await backendFetch(target, {
    method: request.method,
    ...(body ? { body } : {}),
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: { code: "API_UNREACHABLE", message: "Could not reach the Go3net Office API." } },
      { status: 502 },
    );
  }

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const json = await upstream.json().catch(() => null);
  return NextResponse.json(json, { status: upstream.status });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export async function POST(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export async function PATCH(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export async function PUT(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
export async function DELETE(request: NextRequest, context: Context) {
  return proxy(request, (await context.params).path);
}
