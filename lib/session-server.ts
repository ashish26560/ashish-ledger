import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/auth";
import { apiError, type ApiErrorBody } from "@/lib/api-response";

/**
 * Reads and verifies the session directly from the cookie, inside the route
 * handler.
 *
 * Middleware has already checked this, so re-verifying looks redundant — it
 * isn't. The alternative is for middleware to pass the user id down in a
 * request header, and headers are attacker-controlled input: anything that
 * ever reached a route without passing through middleware (a matcher change, a
 * route excluded by mistake, a direct invocation) would let a caller name
 * whatever user id they liked. Verifying the signature here means the identity
 * a query is scoped to can only come from a cookie this server signed. One
 * extra HMAC per request is a rounding error next to the database round trip.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;

  return verifySessionToken(token, secret);
}

export type RequiredSession =
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse<ApiErrorBody> };

/**
 * `const { session, error } = await requireSession(); if (error) return error;`
 * — same shape as parseJsonBody, so routes read consistently.
 */
export async function requireSession(): Promise<RequiredSession> {
  const session = await getSession();
  if (!session) return { error: apiError("Not signed in.", 401) };
  return { session };
}
