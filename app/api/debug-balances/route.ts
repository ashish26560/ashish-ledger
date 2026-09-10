import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// TEMPORARY diagnostic route — not linked from anywhere in the UI. Delete
// this file once the `balances` mystery is resolved.
//
// Two things it answers:
//
// 1. Is the row real, or is this connection seeing a stale snapshot? The
//    row's `xmin` is the transaction id that inserted it. Compare it to the
//    current snapshot's xmin/xmax: if xmin sits below the snapshot floor the
//    row is long-committed and genuinely present, and a DELETE that had
//    committed would have removed it.
//
// 2. Can the app's own connection delete it? GET with ?clear=yes-really
//    runs `DELETE FROM balances` through the exact same client the app uses
//    and reports what it removed. Nothing is deleted without that parameter.
export const dynamic = "force-dynamic";

function describeConnection() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { error: "DATABASE_URL is not set" };
  try {
    const u = new URL(raw);
    return { host: u.hostname, database: u.pathname.replace(/^\//, ""), user: u.username };
  } catch {
    return { error: "DATABASE_URL could not be parsed" };
  }
}

export async function GET(request: Request) {
  const clear = new URL(request.url).searchParams.get("clear") === "yes-really";

  try {
    let deleted: unknown[] | null = null;
    if (clear) {
      deleted = await sql`DELETE FROM balances RETURNING account, balance, as_of`;
    }

    const balances = await sql`SELECT account, balance, as_of, xmin::text AS xmin FROM balances`;
    const txCount = await sql`SELECT count(*)::int AS n FROM transactions`;
    const meta = await sql`
      SELECT
        current_database() AS db,
        current_schema() AS schema,
        pg_backend_pid() AS backend_pid,
        pg_snapshot_xmin(pg_current_snapshot())::text AS snapshot_xmin,
        pg_snapshot_xmax(pg_current_snapshot())::text AS snapshot_xmax,
        now() AS ts
    `;

    return NextResponse.json(
      {
        conn: describeConnection(),
        meta: meta[0],
        cleared: clear,
        deletedRows: deleted,
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
