"use client";

import { useMemo, useState } from "react";
import { useLedger } from "@/lib/DataContext";
import { formatDate, formatINR, uniqueAccounts } from "@/lib/data";
import ImportStatementModal from "@/components/ImportStatementModal";

interface AccountStats {
  debit: number;
  credit: number;
  count: number;
}

export default function AccountsPage() {
  const { transactions, balances, updateBalance } = useLedger();
  const [edits, setEdits] = useState<Record<string, string | undefined>>({});
  const [importOpen, setImportOpen] = useState(false);

  const perAccount = useMemo(() => {
    const map: Record<string, AccountStats> = {};
    for (const t of transactions) {
      if (!map[t.Account]) map[t.Account] = { debit: 0, credit: 0, count: 0 };
      map[t.Account].count += 1;
      if (t.Type === "Debit") map[t.Account].debit += Number(t.Amount);
      else map[t.Account].credit += Number(t.Amount);
    }
    return map;
  }, [transactions]);

  // Every account that appears in the ledger gets a card here, whether or
  // not it already has a balances row — otherwise an account with no
  // balance yet (a brand-new database, or one that got cleared) would have
  // no card at all, and no way to enter one for the first time.
  const allAccounts = useMemo(() => {
    return Array.from(new Set([...uniqueAccounts(transactions), ...Object.keys(balances)])).sort();
  }, [transactions, balances]);

  function save(account: string) {
    const val = edits[account];
    if (val == null || val === "") return;
    updateBalance(account, Number(val), new Date().toISOString().slice(0, 10));
    setEdits((e) => ({ ...e, [account]: undefined }));
  }

  return (
    <div className="px-4 md:px-10 py-6 md:py-8 max-w-3xl">
      <header className="mb-5 md:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Accounts</h1>
          <p className="text-sm text-muted mt-1">
            Closing balances update automatically only when you tell them to — upload a statement
            below, or enter the latest figure by hand.
          </p>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="border border-line rounded px-4 py-2.5 sm:py-2 text-sm whitespace-nowrap hover:bg-paperDim/60 active:bg-paperDim transition-colors shrink-0"
        >
          Upload statement
        </button>
      </header>

      <div className="space-y-4 md:space-y-6">
        {allAccounts.map((account) => {
          const b = balances[account];
          const stats: AccountStats = perAccount[account] || { debit: 0, credit: 0, count: 0 };
          return (
            <div key={account} className="border border-line rounded bg-paper p-4 md:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-4">
                <h2 className="font-display text-lg md:text-xl">{account}</h2>
                <span className="text-xs text-muted">{b ? `as of ${formatDate(b.asOf)}` : "no balance recorded yet"}</span>
              </div>

              {/* Closing balance is the headline, so it spans the full width
                  on phones with debits/credits paired beneath it. */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4">
                <div className="col-span-2 md:col-span-1">
                  <p className="text-xs text-muted mb-1">Closing balance</p>
                  <p className="font-mono tabular text-xl text-forestDeep break-all">
                    {b ? formatINR(b.balance) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Total debits</p>
                  <p className="font-mono tabular text-lg md:text-xl text-rust break-all">{formatINR(stats.debit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Total credits</p>
                  <p className="font-mono tabular text-lg md:text-xl break-all">{formatINR(stats.credit)}</p>
                </div>
              </div>

              <div className="flex gap-2 items-center pt-3 border-t border-line">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Update balance..."
                  value={edits[account] ?? ""}
                  onChange={(e) => setEdits((s) => ({ ...s, [account]: e.target.value }))}
                  aria-label={`New balance for ${account}`}
                  className="border border-line rounded px-2 py-2 md:py-1.5 text-sm font-mono flex-1 min-w-0 bg-paper"
                />
                <button
                  onClick={() => save(account)}
                  className="bg-ink text-paper rounded px-4 py-2 md:py-1.5 text-sm hover:bg-forestDeep active:bg-forestDeep transition-colors shrink-0"
                >
                  Update
                </button>
              </div>
            </div>
          );
        })}

        {allAccounts.length === 0 && (
          <div className="border border-dashed border-line rounded px-4 py-10 text-center">
            <p className="text-sm text-muted">
              No accounts yet. Upload a bank statement or log an expense, and the account it belongs
              to will appear here.
            </p>
          </div>
        )}
      </div>

      <ImportStatementModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
