"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLedger } from "@/lib/DataContext";
import { formatINR } from "@/lib/data";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/recurring", label: "Recurring" },
  { href: "/accounts", label: "Accounts" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { balances } = useLedger();
  const total = Object.values(balances).reduce((s, b) => s + Number(b.balance || 0), 0);

  return (
    <aside className="w-[260px] shrink-0 border-r border-line bg-paperDim flex flex-col">
      <div className="px-6 pt-8 pb-6 ledger-rule-strong">
        <p className="font-display italic text-lg text-ink leading-none">Ashish's</p>
        <p className="font-display text-2xl text-ink leading-tight">Ledger</p>
      </div>

      <nav className="px-3 pt-4">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 mb-1 text-sm rounded transition-colors ${
                active
                  ? "bg-ink text-paper"
                  : "text-ink hover:bg-line/60"
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
        </div>
        <div className="flex justify-between items-baseline pt-2 border-t border-ink">
          <span className="text-sm">Total</span>
          <span className="font-mono tabular text-base font-medium text-forestDeep">
            {formatINR(total)}
          </span>
        </div>
      </div>
    </aside>
  );
}
