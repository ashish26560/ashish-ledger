"use client";

import { useState } from "react";
import { useLedger } from "@/lib/DataContext";
import Select from "@/components/Select";
import { formatDate, formatINR, CATEGORY_ORDER } from "@/lib/data";
import type { Category } from "@/lib/categories";
import type { Transaction } from "@/lib/types";

interface TransactionsTableProps {
  rows: Transaction[];
}

// Rendered twice: as a real table from `md` up, and as stacked cards below
// it. Six columns can't be squeezed into a phone width without either
// sideways scrolling or unreadable truncation, and a transaction reads
// naturally as a card — description first, amount right, meta underneath.
export default function TransactionsTable({ rows }: TransactionsTableProps) {
  const { updateTransaction, deleteTransaction } = useLedger();
  // Touch screens have no hover, so the `title` tooltip that reveals the full
  // bank narration on desktop is unreachable there — tapping the description
  // expands it instead.
  const [expanded, setExpanded] = useState<string | null>(null);

  const categoryOptions = CATEGORY_ORDER.map((c) => ({ value: c, label: c }));

  if (rows.length === 0) {
    return (
      <div className="border border-line rounded bg-paper px-4 py-10 text-center text-sm text-muted">
        No transactions match these filters.
      </div>
    );
  }

  return (
    <>
      {/* Phones: one card per transaction */}
      <ul className="md:hidden space-y-2">
        {rows.map((tx) => (
          <li key={tx.id} className="border border-line rounded bg-paper px-4 py-3">
            {(() => {
              const hasMore = Boolean(tx.FullDescription) && tx.FullDescription !== tx.Description;
              const isOpen = expanded === tx.id;
              return (
                <>
                  <div className="flex justify-between items-start gap-3">
                    {hasMore ? (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : tx.id)}
                        aria-expanded={isOpen}
                        className="text-sm font-medium min-w-0 break-words text-left"
                      >
                        {tx.Description}
                        <span className="text-muted font-normal"> {isOpen ? "▾" : "▸"}</span>
                      </button>
                    ) : (
                      <p className="text-sm font-medium min-w-0 break-words">{tx.Description}</p>
                    )}
                    <span
                      className={`font-mono tabular text-sm shrink-0 ${
                        tx.Type === "Credit" ? "text-forestDeep" : "text-ink"
                      }`}
                    >
                      {tx.Type === "Credit" ? "+" : "-"}
                      {formatINR(tx.Amount)}
                    </span>
                  </div>

                  {hasMore && isOpen && (
                    <p className="text-xs text-muted mt-2 break-words bg-paperDim rounded px-2 py-1.5">
                      {tx.FullDescription}
                    </p>
                  )}
                </>
              );
            })()}

            <p className="text-xs text-muted mt-1">
              {formatDate(tx.Date)}
              {tx.Time && ` · ${tx.Time}`} · {tx.Account}
            </p>

            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-line">
              <Select
                label={`Category for ${tx.Description}`}
                value={tx.Category}
                onChange={(v) => updateTransaction(tx.id, { Category: v as Category })}
                options={categoryOptions}
                className="flex-1 min-w-0 bg-paperDim"
              />
              <button
                onClick={() => deleteTransaction(tx.id)}
                className="text-muted hover:text-rust active:text-rust text-xs shrink-0 h-9 w-9 flex items-center justify-center rounded border border-line"
                aria-label={`Delete transaction: ${tx.Description}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up: the full ledger table */}
      <div className="hidden md:block border border-line rounded bg-paper overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="ledger-rule-strong text-left text-xs text-muted">
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-4 py-2 font-normal">Account</th>
                <th className="px-4 py-2 font-normal">Description</th>
                <th className="px-4 py-2 font-normal">Category</th>
                <th className="px-4 py-2 font-normal text-right">Amount</th>
                <th className="px-4 py-2 font-normal w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-paperDim/60">
                  <td className="px-4 py-2 font-mono tabular text-xs text-muted whitespace-nowrap">
                    {formatDate(tx.Date)}
                    {tx.Time && <span className="block text-[10px] opacity-70">{tx.Time}</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">{tx.Account}</td>
                  <td className="px-4 py-2 max-w-[260px] truncate" title={tx.FullDescription || tx.Description}>
                    {tx.Description}
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      label={`Category for ${tx.Description}`}
                      value={tx.Category}
                      onChange={(v) => updateTransaction(tx.id, { Category: v as Category })}
                      options={categoryOptions}
                      className="w-full max-w-[190px] bg-transparent border-transparent hover:border-line"
                    />
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono tabular whitespace-nowrap ${
                      tx.Type === "Credit" ? "text-forestDeep" : "text-ink"
                    }`}
                  >
                    {tx.Type === "Credit" ? "+" : "-"}
                    {formatINR(tx.Amount)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="text-muted hover:text-rust text-xs"
                      aria-label={`Delete transaction: ${tx.Description}`}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
