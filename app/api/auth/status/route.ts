import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Tells the sign-in screen whether to offer a "create an account" option.
 *
 * Registration is open only when an invite code is configured. This exposes
 * that one bit and nothing else — not how many accounts exist, not who they
 * belong to, and never the code itself.
 */
export async function GET() {
  return NextResponse.json(
    { registrationOpen: Boolean(process.env.SIGNUP_INVITE_CODE) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
