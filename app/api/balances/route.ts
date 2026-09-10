import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { apiInternalError, parseJsonBody } from "@/lib/api-response";
import { putBalanceBodySchema } from "@/lib/schemas";
import { requireSession } from "@/lib/session-server";
import type { AccountBalance, BalancesByAccount } from "@/lib/types";

// GET here takes no request-specific input (no headers/cookies/searchParams),
// so without this, Next.js treats it as static-optimizable and Vercel's edge
// can end up only knowing about a cached GET for this path — any other
// method (our PUT) then gets bounced with a 405 before it ever reaches this
// file. Forcing dynamic rendering guarantees every request, of every method,
// actually runs this handler against the live database.
export const dynamic = "force-dynamic";

interface BalanceRow {
  account: string;
  balance: string;
  as_of: string;
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const rows = (await sql`
      SELECT account, balance, as_of FROM balances WHERE user_id = ${session.userId}
    `) as BalanceRow[];
    const balances: BalancesByAccount = {};
    for (const row of rows) {
      const entry: AccountBalance = { balance: Number(row.balance), asOf: row.as_of };
      balances[row.account] = entry;
    }
    return NextResponse.json(balances);
  } catch (err) {
    return apiInternalError("GET /api/balances", err);
  }
}

export async function PUT(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const parsed = await parseJsonBody(request, putBalanceBodySchema);
  if (parsed.error) return parsed.error;

  const { account, balance, asOf } = parsed.data;
  try {
    await sql`
      INSERT INTO balances (user_id, account, balance, as_of)
      VALUES (${session.userId}, ${account}, ${balance}, ${asOf})
      ON CONFLICT (user_id, account) DO UPDATE SET balance = EXCLUDED.balance, as_of = EXCLUDED.as_of
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiInternalError("PUT /api/balances", err);
  }
}
