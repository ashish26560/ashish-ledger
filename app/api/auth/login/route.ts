import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { apiError, apiInternalError, parseJsonBody } from "@/lib/api-response";
import { credentialsSchema } from "@/lib/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookie";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

// Verifying a password takes a measurable amount of time; returning early for
// an unknown email would make "no such account" respond faster than "wrong
// password", letting someone probe which emails exist. So an unknown email is
// checked against a throwaway hash instead, and both paths cost the same. It's
// computed once per process, lazily, and never matches anything.
let placeholderHash: Promise<string> | null = null;
function getPlaceholderHash(): Promise<string> {
  placeholderHash ??= hashPassword(crypto.randomUUID());
  return placeholderHash;
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, credentialsSchema);
  if (parsed.error) return parsed.error;

  const { email, password } = parsed.data;

  try {
    const rows = (await sql`
      SELECT id, email, password_hash FROM users WHERE email = ${email}
    `) as UserRow[];
    const user = rows[0];

    const passwordOk = user
      ? await verifyPassword(password, user.password_hash)
      : await verifyPassword(password, await getPlaceholderHash());

    // One message for both failure modes, so it reveals nothing either way.
    if (!user || !passwordOk) {
      return apiError("Incorrect email or password.", 401);
    }

    return await setSessionCookie(NextResponse.json({ ok: true, email: user.email }), user);
  } catch (err) {
    return apiInternalError("POST /api/auth/login", err);
  }
}
