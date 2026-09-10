import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { apiError, apiInternalError, parseJsonBody } from "@/lib/api-response";
import { registerSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookie";

export const dynamic = "force-dynamic";

/**
 * Creates an account, gated on an invite code.
 *
 * This endpoint is reachable without a session by necessity — you can't
 * require a login to create your first login — so something has to stand
 * between it and the open internet. That's `SIGNUP_INVITE_CODE`: if it isn't
 * configured, registration is off entirely rather than open by default. The
 * code is required for every account including the first, so nobody can claim
 * the first account in the window between deploying and signing up.
 */
function compareInviteCode(supplied: string, expected: string): boolean {
  // Constant-time: a short-circuiting compare would let someone recover the
  // code a character at a time by timing the response.
  if (supplied.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < supplied.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, registerSchema);
  if (parsed.error) return parsed.error;

  const expectedCode = process.env.SIGNUP_INVITE_CODE;
  if (!expectedCode) {
    return apiError("Registration is closed.", 403);
  }

  const { email, password, inviteCode } = parsed.data;
  if (!compareInviteCode(inviteCode, expectedCode)) {
    return apiError("That invite code isn't valid.", 403);
  }

  try {
    const id = randomUUID();
    const passwordHash = await hashPassword(password);

    const rows = (await sql`
      INSERT INTO users (id, email, password_hash)
      VALUES (${id}, ${email}, ${passwordHash})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email
    `) as { id: string; email: string }[];

    // ON CONFLICT rather than letting the UNIQUE violation throw, so a
    // duplicate reads as a clear 409 instead of a generic 500.
    if (rows.length === 0) {
      return apiError("An account with that email already exists. Sign in instead.", 409);
    }

    return await setSessionCookie(NextResponse.json({ ok: true, email: rows[0].email }, { status: 201 }), rows[0]);
  } catch (err) {
    return apiInternalError("POST /api/auth/register", err);
  }
}
