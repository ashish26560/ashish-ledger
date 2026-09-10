import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken, requireAuthSecret } from "@/lib/auth";

/**
 * Attaches a fresh session cookie to a response.
 *
 * `httpOnly` keeps the token out of reach of any script on the page, so an XSS
 * bug can't exfiltrate it. `sameSite: "lax"` means it isn't sent on
 * cross-site POSTs, which is what stops another site from firing writes at
 * these API routes on your behalf. `secure` is on everywhere except local
 * development, where there's no HTTPS to attach it to.
 */
export async function setSessionCookie(
  response: NextResponse,
  user: { id: string; email: string }
): Promise<NextResponse> {
  const secret = requireAuthSecret();
  const token = await createSessionToken(
    { userId: user.id, email: user.email, exp: Date.now() + SESSION_TTL_MS },
    secret
  );

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
