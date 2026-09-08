"use client";

import { useMemo, useState } from "react";
import { useLedger } from "@/lib/DataContext";
import { formatINR, EXCLUDED_FROM_EXPENSE } from "@/lib/data";

export default function AccountsPage() {
  const { transactions, balances, updateBalance } = useLedger();
  const [edits, setEdits] = useState({});

  const perAccount = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (!map[t.Account]) map[t.Account] = { debit: 0, credit: 0, count: 0 };
      map[t.Account].count += 1;
      if (t.Type === "Debit") map[t.Account].debit += Number(t.Amount);
      else map[t.Account].credit += Number(t.Amount);
    }
    return map;
  }, [transactions]);

  function save(account) {
    const val = edits[account];
    if (val == null || val === "") return;
    updateBalance(account, Number(val), new Date().toISOString().slice(0, 10));
    setEdits((e) => ({ ...e, [account]: undefined }));
  }

  return (
    <div className="px-10 py-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Accounts</h1>
        <p className="text-sm text-muted mt-1">
          Closing balances update automatically only when you tell them to — enter the latest
          figure from your bank statement here.
        </p>
      </header>

      <div className="space-y-6">
        {Object.entries(balances).map(([account, b]) => {
          const stats = perAccount[account] || { debit: 0, credit: 0, count: 0 };
          return (
            <div key={account} className="border border-line rounded bg-paper p-5">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-display text-xl">{account}</h2>
                <span className="text-xs text-muted">as of {b.asOf}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted mb-1">Closing balance</p>
                  <p className="font-mono tabular text-xl text-forestDeep">
                    {formatINR(b.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Total debits</p>
                  <p className="font-mono tabular text-xl text-rust">{formatINR(stats.debit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Total credits</p>
                  <p className="font-mono tabular text-xl">{formatINR(stats.credit)}</p>
                </div>
              </div>

              <div className="flex gap-2 items-center pt-3 border-t border-line">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Update balance..."
                  value={edits[account] ?? ""}
                  onChange={(e) => setEdits((s) => ({ ...s, [account]: e.target.value }))}
                  className="border border-line rounded px-2 py-1.5 text-sm font-mono flex-1 bg-paper"
                />
                <button
                  onClick={() => save(account)}
                  className="bg-ink text-paper rounded px-3 py-1.5 text-sm hover:bg-forestDeep transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
