"use client";

import { useLedger } from "@/lib/DataContext";
import { formatINR } from "@/lib/data";
import Link from "next/link";
import { APP_NAME } from "@/lib/branding";

// Phones lose the sidebar, and with it the running balance — which is the
// one number worth seeing from every screen. This puts it back as a compact
// sticky header alongside the wordmark.
export default function MobileTopBar() {
  const { balances } = useLedger();
  const accounts = Object.entries(balances);
  const total = accounts.reduce((s, [, b]) => s + Number(b.balance || 0), 0);

  return (
    <header className="md:hidden sticky top-0 z-30 bg-paperDim/95 backdrop-blur-sm border-b border-line">
      <div className="flex items-center justify-between px-4 h-14">
        <p className="font-display text-lg text-ink leading-none">{APP_NAME}</p>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-muted leading-none mb-1">
              {accounts.length > 0 ? "Available" : "No balances yet"}
            </p>
            {accounts.length > 0 && (
              <p className="font-mono tabular text-sm text-forestDeep leading-none">{formatINR(total)}</p>
            )}
          </div>
          {/* Sign out lives inside Settings on phones — two icons in a 56px
              bar is cramped, and signing out is rarer than glancing at this. */}
          <Link href="/settings" aria-label="Settings" className="text-muted hover:text-ink p-1 -mr-1">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.63.67 1.1 1.31 1.1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
