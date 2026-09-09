import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { apiInternalError, parseJsonBody } from "@/lib/api-response";
import { putBalanceBodySchema } from "@/lib/schemas";
import type { AccountBalance, BalancesByAccount } from "@/lib/types";

interface BalanceRow {
  account: string;
  balance: string;
  as_of: string;
}

export async function GET() {
  try {
    const rows = (await sql`SELECT account, balance, as_of FROM balances`) as BalanceRow[];
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
  const parsed = await parseJsonBody(request, putBalanceBodySchema);
  if (parsed.error) return parsed.error;

  const { account, balance, asOf } = parsed.data;
  try {
    await sql`
      INSERT INTO balances (account, balance, as_of)
      VALUES (${account}, ${balance}, ${asOf})
      ON CONFLICT (account) DO UPDATE SET balance = EXCLUDED.balance, as_of = EXCLUDED.as_of
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiInternalError("PUT /api/balances", err);
  }
}
