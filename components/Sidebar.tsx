"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLedger } from "@/lib/DataContext";
import { formatINR } from "@/lib/data";
import { NAV } from "@/lib/nav";
import SignOutButton from "@/components/SignOutButton";
import { APP_NAME } from "@/lib/branding";

// Desktop-only. Phones get MobileTopBar + MobileTabBar instead, so this is
// hidden below `md` rather than trying to be two layouts at once.
export default function Sidebar() {
  const pathname = usePathname();
  const { balances, email } = useLedger();
  const total = Object.values(balances).reduce((s, b) => s + Number(b.balance || 0), 0);

  return (
    // Full height of the shell's fixed frame (see AppShell), so `mt-auto` on
    // the balance block below pushes it to the bottom of the screen rather
    // than to the bottom of a column that has scrolled out of view.
    <aside className="hidden md:flex w-[260px] shrink-0 border-r border-line bg-paperDim flex-col h-full min-h-0 overflow-y-auto">
      <div className="px-6 pt-8 pb-6 ledger-rule-strong">
        <p className="font-display text-2xl text-ink leading-tight">{APP_NAME}</p>
        {email && <p className="text-xs text-muted mt-1 truncate">{email}</p>}
      </div>

      <nav className="px-3 pt-4">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`block px-3 py-2 mb-1 text-sm rounded transition-colors ${
                active ? "bg-ink text-paper" : "text-ink hover:bg-line/60"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-6 py-6 ledger-rule border-t border-line">
        <p className="text-xs text-muted mb-3">Available balance</p>
        <div className="space-y-2 mb-4">
          {Object.entries(balances).map(([account, b]) => (
            <div key={account} className="flex justify-between items-baseline">
              <span className="text-xs text-muted truncate pr-2">{account}</span>
              <span className="font-mono tabular text-sm">{formatINR(b.balance)}</span>
            </div>
          ))}
          {Object.keys(balances).length === 0 && (
            <p className="text-xs text-muted italic">No balances recorded yet.</p>
          )}
        </div>
        <div className="flex justify-between items-baseline pt-2 border-t border-ink">
          <span className="text-sm">Total</span>
          <span className="font-mono tabular text-base font-medium text-forestDeep">{formatINR(total)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/settings"
            className="border border-line rounded py-1.5 text-xs text-muted hover:text-ink hover:bg-line/40 transition-colors text-center"
          >
            Settings
          </Link>
          <SignOutButton className="border border-line rounded py-1.5 text-xs text-muted hover:text-ink hover:bg-line/40 transition-colors" />
        </div>
      </div>
    </aside>
  );
}
