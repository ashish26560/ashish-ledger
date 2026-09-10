import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { apiError, apiInternalError, parseJsonBody } from "@/lib/api-response";
import { changePasswordSchema } from "@/lib/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookie";
import { requireSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

/**
 * Changes the signed-in user's password.
 *
 * The current password is required even though the caller is already signed
 * in: without it, anyone who got hold of an unlocked device or a stolen
 * session could lock the real owner out of their own ledger.
 *
 * Note the limitation — sessions are stateless signed tokens, so changing a
 * password does NOT sign out other devices; they stay valid until they expire.
 * Revoking them would need a token version stored per user and checked on
 * every request. The cookie for *this* device is re-issued so the person
 * changing it isn't logged out.
 */
export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const parsed = await parseJsonBody(request, changePasswordSchema);
  if (parsed.error) return parsed.error;

  const { currentPassword, newPassword } = parsed.data;

  try {
    const rows = (await sql`
      SELECT password_hash FROM users WHERE id = ${session.userId}
    `) as { password_hash: string }[];

    const user = rows[0];
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return apiError("That's not your current password.", 401);
    }

    const nextHash = await hashPassword(newPassword);
    await sql`UPDATE users SET password_hash = ${nextHash} WHERE id = ${session.userId}`;

    return await setSessionCookie(NextResponse.json({ ok: true }), {
      id: session.userId,
      email: session.email,
    });
  } catch (err) {
    return apiInternalError("POST /api/auth/password", err);
  }
}
