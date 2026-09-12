import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { apiError, apiInternalError, parseJsonBody } from "@/lib/api-response";
import { patchTransactionBodySchema, type PatchTransactionInput } from "@/lib/schemas";
import { requireSession } from "@/lib/session-server";

// The [id] segment already makes this dynamic in practice, but this is
// explicit belt-and-braces alongside the other two route files — a mutating
// endpoint should never risk being served from a cache.
export const dynamic = "force-dynamic";

// Whitelisted mapping from the app's PascalCase field names to the
// database's snake_case columns. sql.unsafe() is only ever given a name
// from this object (never anything derived from the request body), so this
// can't become a SQL-injection point despite the name.
const EDITABLE_FIELDS: Record<keyof PatchTransactionInput, string> = {
  Date: "date",
  Time: "time",
  Account: "account",
  Description: "description",
  FullDescription: "full_description",
  Category: "category",
  Subcategory: "subcategory",
  Pot: "pot",
  Type: "type",
  Amount: "amount",
  Balance: "balance",
};

interface RouteContext {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = params;
  const { session, error } = await requireSession();
  if (error) return error;

  const parsed = await parseJsonBody(request, patchTransactionBodySchema);
  if (parsed.error) return parsed.error;

  try {
    const entries = Object.entries(parsed.data) as [keyof PatchTransactionInput, unknown][];
    let matched = 0;

    for (const [field, value] of entries) {
      const column = EDITABLE_FIELDS[field];
      // `AND user_id` is what stops one account editing another's rows: an id
      // is guessable, ownership isn't.
      // Clearing a pot has to store NULL, not "": an empty string would be a
      // real pot name that every cleared row silently joined.
      const stored = field === "Pot" && value === "" ? null : value;
      const updated = (await sql`
        UPDATE transactions SET ${sql.unsafe(column)} = ${stored}
        WHERE id = ${id} AND user_id = ${session.userId}
        RETURNING id
      `) as { id: string }[];
      matched = updated.length;
    }

    // Same answer whether the row belongs to someone else or doesn't exist —
    // "forbidden" would confirm that this id is real.
    if (entries.length > 0 && matched === 0) {
      return apiError("Transaction not found.", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiInternalError(`PATCH /api/transactions/${id}`, err);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = params;
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const deleted = (await sql`
      DELETE FROM transactions WHERE id = ${id} AND user_id = ${session.userId} RETURNING id
    `) as { id: string }[];

    if (deleted.length === 0) return apiError("Transaction not found.", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiInternalError(`DELETE /api/transactions/${id}`, err);
  }
}
