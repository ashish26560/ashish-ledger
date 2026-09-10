import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Reachable without a session, by necessity: the sign-in screen itself, and
// the endpoints it calls. Everything else — every page, and every data API —
// requires a valid session cookie.
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/status",
]);

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Fail closed. The previous version of this gate let everyone through when
  // its password variable was unset, which meant a misconfigured deployment
  // silently published real financial data to the open internet while looking
  // like it was working. A missing secret is now a hard stop.
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    const message =
      "AUTH_SECRET is not configured, so this deployment can't verify sign-ins. " +
      "Generate one with `openssl rand -base64 32` and add it to the project's environment variables.";
    return isApiRequest(pathname)
      ? NextResponse.json({ error: message }, { status: 503 })
      : new NextResponse(message, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token, secret) : null;

  if (!session) {
    // API callers get a status code they can act on; humans get the sign-in
    // page, with where they were headed preserved.
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own static output. Pages and API routes alike
  // need the gate; `_next/static` and `_next/image` hold no ledger data.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
