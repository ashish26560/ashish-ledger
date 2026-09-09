import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { apiInternalError, parseJsonBody } from "@/lib/api-response";
import { patchTransactionBodySchema, type PatchTransactionInput } from "@/lib/schemas";

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
  Type: "type",
  Amount: "amount",
  Balance: "balance",
};

interface RouteContext {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = params;
  const parsed = await parseJsonBody(request, patchTransactionBodySchema);
  if (parsed.error) return parsed.error;

  try {
    const entries = Object.entries(parsed.data) as [keyof PatchTransactionInput, unknown][];
    for (const [field, value] of entries) {
      const column = EDITABLE_FIELDS[field];
      await sql`UPDATE transactions SET ${sql.unsafe(column)} = ${value} WHERE id = ${id}`;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiInternalError(`PATCH /api/transactions/${id}`, err);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = params;
  try {
    await sql`DELETE FROM transactions WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiInternalError(`DELETE /api/transactions/${id}`, err);
  }
}
