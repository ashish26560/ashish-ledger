import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { apiError, apiInternalError, parseJsonBody } from "@/lib/api-response";
import { credentialsSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookie";

export const dynamic = "force-dynamic";

/**
 * Creates the very first account, and only that one.
 *
 * This endpoint has to be reachable without a session — otherwise there'd be
 * no way to make the first account — so it closes itself permanently the
 * moment a user exists. Without that check it would be open registration on a
 * personal ledger. The count and the insert run as a single statement so two
 * simultaneous requests can't both pass the check; the UNIQUE constraint on
 * email is the backstop.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, credentialsSchema);
  if (parsed.error) return parsed.error;

  const { email, password } = parsed.data;

  try {
    const id = randomUUID();
    const passwordHash = await hashPassword(password);

    const rows = (await sql`
      INSERT INTO users (id, email, password_hash)
      SELECT ${id}, ${email}, ${passwordHash}
      WHERE NOT EXISTS (SELECT 1 FROM users)
      RETURNING id, email
    `) as { id: string; email: string }[];

    if (rows.length === 0) {
      return apiError("An account already exists. Sign in instead.", 403);
    }

    return await setSessionCookie(NextResponse.json({ ok: true, email: rows[0].email }, { status: 201 }), rows[0]);
  } catch (err) {
    return apiInternalError("POST /api/auth/register", err);
  }
}
