"use client";

import { useLedger } from "@/lib/DataContext";
import { formatINR, CATEGORY_ORDER } from "@/lib/data";

export default function TransactionsTable({ rows }) {
  const { updateTransaction, deleteTransaction } = useLedger();

  return (
    <div className="border border-line rounded bg-paper overflow-hidden">
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
                  {tx.Date}
                </td>
                <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">{tx.Account}</td>
                <td className="px-4 py-2 max-w-[260px] truncate" title={tx.Description}>
                  {tx.Description}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={tx.Category}
                    onChange={(e) => updateTransaction(tx.id, { Category: e.target.value })}
                    className="bg-transparent border border-transparent hover:border-line rounded text-xs py-1 px-1 -ml-1"
                  >
                    {CATEGORY_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
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
                    aria-label="Delete transaction"
                    title="Delete"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No transactions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
