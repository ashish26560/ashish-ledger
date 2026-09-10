"use client";

import { useLedger } from "@/lib/DataContext";
import { formatINR } from "@/lib/data";

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
        <p className="font-display text-lg text-ink leading-none">
          <span className="italic text-sm">Ashish&apos;s</span> Ledger
        </p>
        <div className="text-right">
          <p className="text-[10px] text-muted leading-none mb-1">
            {accounts.length > 0 ? "Available" : "No balances yet"}
          </p>
          {accounts.length > 0 && (
            <p className="font-mono tabular text-sm text-forestDeep leading-none">{formatINR(total)}</p>
          )}
        </div>
      </div>
    </header>
  );
}
