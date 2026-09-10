import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { apiInternalError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * Tells the login screen whether to offer "sign in" or first-run "create your
 * account". Reachable without a session by necessity — it exposes only whether
 * any account exists at all, never who or how many.
 */
export async function GET() {
  try {
    const rows = (await sql`SELECT EXISTS (SELECT 1 FROM users) AS has_user`) as { has_user: boolean }[];
    return NextResponse.json(
      { needsSetup: !rows[0]?.has_user },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return apiInternalError("GET /api/auth/status", err);
  }
}
