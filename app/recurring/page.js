"use client";

import { useMemo } from "react";
import { useLedger } from "@/lib/DataContext";
import { uniqueMonths, monthLabel, formatINR } from "@/lib/data";

export default function RecurringPage() {
  const { transactions } = useLedger();
  const months = useMemo(() => uniqueMonths(transactions), [transactions]);

  const items = useMemo(() => {
    const withSub = transactions.filter((t) => t.Subcategory);
    const subs = Array.from(new Set(withSub.map((t) => t.Subcategory))).sort();
    const table = subs.map((sub) => {
      const row = { sub, byMonth: {}, total: 0 };
      for (const m of months) row.byMonth[m] = 0;
      for (const t of withSub) {
        if (t.Subcategory === sub) {
          row.byMonth[t.Month] = (row.byMonth[t.Month] || 0) + Number(t.Amount);
          row.total += Number(t.Amount);
        }
      }
      return row;
    });
    return table;
  }, [transactions, months]);

  const monthTotals = months.map((m) =>
    items.reduce((s, row) => s + (row.byMonth[m] || 0), 0)
  );
  const grandTotal = items.reduce((s, row) => s + row.total, 0);

  return (
    <div className="px-10 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Recurring &amp; fixed obligations</h1>
        <p className="text-sm text-muted mt-1">
          EMIs, subscriptions, and insurance premiums — pulled out from everyday spend.
        </p>
      </header>

      <div className="border border-line rounded bg-paper overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="ledger-rule-strong text-left text-xs text-muted">
              <th className="px-4 py-2 font-normal min-w-[220px]">Item</th>
              {months.map((m) => (
                <th key={m} className="px-4 py-2 font-normal text-right whitespace-nowrap">
                  {monthLabel(m)}
                </th>
              ))}
              <th className="px-4 py-2 font-normal text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((row) => (
              <tr key={row.sub}>
                <td className="px-4 py-2">{row.sub}</td>
                {months.map((m) => (
                  <td key={m} className="px-4 py-2 text-right font-mono tabular text-muted">
                    {row.byMonth[m] ? formatINR(row.byMonth[m]) : "—"}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-mono tabular font-medium">
                  {formatINR(row.total)}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={months.length + 2} className="px-4 py-8 text-center text-muted">
                  No recurring items tagged yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="ledger-rule-strong border-t">
              <td className="px-4 py-2 font-medium text-rust">Total fixed obligations</td>
              {monthTotals.map((v, i) => (
                <td
                  key={months[i]}
                  className="px-4 py-2 text-right font-mono tabular font-medium text-rust"
                >
                  {formatINR(v)}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-mono tabular font-medium text-rust">
                {formatINR(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
