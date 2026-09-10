import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// TEMPORARY diagnostic route — not linked from anywhere in the UI. Delete
// this file once we've figured out why the deployed app and the Neon SQL
// editor appear to disagree about what's in the `balances` table. Reports
// exactly what THIS deployed serverless function sees, at request time, so
// it can be compared directly against a `SELECT * FROM balances;` run in
// the SQL editor at the same moment.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`SELECT account, balance, as_of FROM balances`;
    const meta = await sql`SELECT current_database() AS db, current_schema() AS schema, inet_server_addr() AS server_ip, now() AS ts`;
    return NextResponse.json({ meta: meta[0], rowCount: rows.length, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
