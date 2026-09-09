import { NextResponse, type NextRequest } from "next/server";

// Every page and API route now reads/writes real financial data from a
// shared Postgres database instead of each browser's own private
// localStorage, so — unlike before — anyone who finds the deployed URL
// could otherwise read or edit it. This gates the whole app behind one
// shared password (the browser's native Basic Auth prompt) via a
// SITE_PASSWORD env var. It's intentionally simple: fine for a single
// person's own data, not a substitute for real per-user accounts.
export function middleware(request: NextRequest): NextResponse {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    // Nothing configured — don't lock anyone out (e.g. local dev before
    // you've set it up), just leave the app open. Set SITE_PASSWORD once
    // you're ready to protect a real deployment.
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      // malformed header, fall through to 401
    }
    const separatorIndex = decoded.indexOf(":");
    const suppliedPassword = separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);
    if (suppliedPassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Ashish\'s Ledger"' },
  });
}

export const config = {
  // Everything except Next's own static/internal assets — pages and API
  // routes alike need the gate.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
