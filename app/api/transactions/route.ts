import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { apiInternalError, parseJsonBody } from "@/lib/api-response";
import { postTransactionsBodySchema } from "@/lib/schemas";
import { requireSession } from "@/lib/session-server";
import type { Category } from "@/lib/categories";
import type { Transaction, TransactionType } from "@/lib/types";

// Same reasoning as app/api/balances/route.ts: GET here has no
// request-specific input, so without this Next.js can statically optimize
// it, which risks POST getting a stale edge-cached 405 instead of reaching
// this handler. Force every request to run live against the database.
export const dynamic = "force-dynamic";

// The literal shape @neondatabase/serverless hands back for a `transactions`
// row — NUMERIC columns arrive as strings, which is why `rowToTransaction`
// below does its own `Number(...)` conversion rather than trusting the type.
interface TransactionRow {
  id: string;
  date: string;
  time: string | null;
  account: string;
  description: string;
  full_description: string | null;
  category: string;
  subcategory: string | null;
  pot: string | null;
  type: string;
  amount: string;
  balance: string | null;
}

// Shapes a DB row into the same object shape the app has always used, so
// nothing downstream of DataContext needs to know a database exists.
function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    Date: row.date,
    Time: row.time || "",
    Account: row.account,
    Description: row.description,
    FullDescription: row.full_description || "",
    Category: row.category as Category,
    Subcategory: row.subcategory || "",
    Pot: row.pot || "",
    Type: row.type as TransactionType,
    Amount: Number(row.amount),
    Balance: row.balance == null ? "" : Number(row.balance),
    Month: String(row.date).slice(0, 7),
  };
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    // Scoped to the signed-in user — without this WHERE clause every account
    // would read the same shared ledger.
    const rows = (await sql`
      SELECT id, date, time, account, description, full_description, category, subcategory, pot, type, amount, balance
      FROM transactions
      WHERE user_id = ${session.userId}
      ORDER BY date ASC, time ASC NULLS FIRST
    `) as TransactionRow[];
    return NextResponse.json(rows.map(rowToTransaction));
  } catch (err) {
    return apiInternalError("GET /api/transactions", err);
  }
}

// Accepts { transactions: [...] } — used for both a single manually-logged
// expense and a bulk statement-import batch. The caller (DataContext) is
// responsible for deciding what to send; this just validates and inserts it.
export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const parsed = await parseJsonBody(request, postTransactionsBodySchema);
  if (parsed.error) return parsed.error;

  try {
    const inserted: Transaction[] = [];
    for (const tx of parsed.data.transactions) {
      const id = randomUUID();
      const rows = (await sql`
        INSERT INTO transactions (id, user_id, date, time, account, description, full_description, category, subcategory, pot, type, amount, balance)
        VALUES (
          ${id}, ${session.userId}, ${tx.Date}, ${tx.Time || null}, ${tx.Account}, ${tx.Description}, ${tx.FullDescription},
          ${tx.Category}, ${tx.Subcategory}, ${tx.Pot || null}, ${tx.Type}, ${tx.Amount}, ${tx.Balance}
        )
        RETURNING id, date, time, account, description, full_description, category, subcategory, pot, type, amount, balance
      `) as TransactionRow[];
      inserted.push(rowToTransaction(rows[0]));
    }
    return NextResponse.json({ inserted }, { status: 201 });
  } catch (err) {
    return apiInternalError("POST /api/transactions", err);
  }
}
