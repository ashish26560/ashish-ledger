import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// TEMPORARY diagnostic route — not linked from anywhere in the UI. Delete
// this file once we've figured out why the deployed app and the Neon SQL
// editor appear to disagree about what's in the `balances` table.
//
// The key field here is `conn.host`: current_database()/current_schema()
// are useless for telling two Neon projects apart, because every Neon
// project defaults to a database named "neondb" with a "public" schema.
// The endpoint hostname (ep-xxxx-...) is what actually identifies WHICH
// database this deployment is talking to. The password is never included.
export const dynamic = "force-dynamic";

function describeConnection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { error: "DATABASE_URL is not set" };
  try {
    const u = new URL(raw);
    return {
      host: u.hostname,
      database: u.pathname.replace(/^\//, ""),
      user: u.username,
    };
  } catch {
    return { error: "DATABASE_URL could not be parsed" };
  }
}

export async function GET() {
  try {
    const balances = await sql`SELECT account, balance, as_of FROM balances`;
    const txCount = await sql`SELECT count(*)::int AS n FROM transactions`;
    const meta = await sql`SELECT current_database() AS db, current_schema() AS schema, now() AS ts`;
    return NextResponse.json(
      {
        conn: describeConnection(),
        meta: meta[0],
        transactionCount: txCount[0]?.n,
        balanceRowCount: balances.length,
        balances,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { conn: describeConnection(), error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
