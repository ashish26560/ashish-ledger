import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

/** Who is signed in — so the UI can show whose ledger is on screen. */
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  return NextResponse.json({ email: session.email }, { headers: { "Cache-Control": "no-store" } });
}
