"use client";

import { Fragment, useMemo, useState } from "react";
import { useLedger } from "@/lib/DataContext";
import { uniqueMonths, monthLabel, formatINR, formatDate, formatDateTime, compareDateTime } from "@/lib/data";
import type { Category } from "@/lib/categories";
import type { Transaction } from "@/lib/types";

// The categories that represent fixed/recurring obligations rather than
// everyday variable spend — this is what "Recurring & fixed obligations"
// means in practice, since nothing in the app ever tags a transaction's
// Subcategory (every write path leaves it "") so grouping by that field,
// as this page originally did, could never show anything.
const RECURRING_CATEGORIES: Category[] = [
  "Home Rent",
  "Loan EMI",
  "Credit Card Payment",
  "Insurance",
  "Subscriptions",
  "Bills & Utilities",
  "Electrical/Utilities",
];

interface RecurringRow {
  category: Category;
  byMonth: Record<string, number>;
  total: number;
  transactions: Transaction[];
}

export default function RecurringPage() {
  const { transactions } = useLedger();
  const months = useMemo(() => uniqueMonths(transactions), [transactions]);
  const [expanded, setExpanded] = useState<Category | null>(null);

  const items = useMemo<RecurringRow[]>(() => {
    return RECURRING_CATEGORIES.map((category) => {
      const matching = transactions.filter((t) => t.Category === category);
      const row: RecurringRow = { category, byMonth: {}, total: 0, transactions: matching };
      for (const m of months) row.byMonth[m] = 0;
      for (const t of matching) {
        row.byMonth[t.Month] = (row.byMonth[t.Month] || 0) + Number(t.Amount);
        row.total += Number(t.Amount);
      }
      return row;
    }).filter((row) => row.transactions.length > 0);
  }, [transactions, months]);

  const monthTotals = months.map((m) => items.reduce((s, row) => s + (row.byMonth[m] || 0), 0));
  const grandTotal = items.reduce((s, row) => s + row.total, 0);

  function cellTitle(row: RecurringRow, month: string): string | undefined {
    const inMonth = row.transactions.filter((t) => t.Month === month);
    if (inMonth.length === 0) return undefined;
    return inMonth
      .sort((a, b) => compareDateTime(b, a))
      .map((t) => `${formatDate(t.Date)}  ${t.Description}  ${formatINR(t.Amount)}`)
      .join("\n");
  }

  return (
    <div className="px-4 md:px-10 py-6 md:py-8">
      <header className="mb-5 md:mb-6">
        <h1 className="font-display text-2xl md:text-3xl">Recurring &amp; fixed obligations</h1>
        <p className="text-sm text-muted mt-1">
          EMIs, subscriptions, rent, insurance, and bills — pulled out from everyday spend. Tap a row to
          see everything under that category; on a larger screen, hovering a month&apos;s amount shows that
          month&apos;s transactions.
        </p>
      </header>

      {/* The month columns make this table wider than a phone, so it scrolls
          sideways inside its own box while the category column stays pinned —
          otherwise you'd scroll away from the labels that give the numbers
          meaning. */}
      {months.length > 1 && (
        <p className="md:hidden text-xs text-muted mb-2">Swipe the table sideways for other months →</p>
      )}

      <div className="border border-line rounded bg-paper overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="ledger-rule-strong text-left text-xs text-muted">
              <th className="px-4 py-2 font-normal min-w-[180px] md:min-w-[220px] sticky left-0 bg-paper z-10">
                Category
              </th>
              {months.map((m) => (
                <th key={m} className="px-4 py-2 font-normal text-right whitespace-nowrap">
                  {monthLabel(m)}
                </th>
              ))}
              <th className="px-4 py-2 font-normal text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((row) => {
              const isOpen = expanded === row.category;
              return (
                <Fragment key={row.category}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : row.category)}
                    className="cursor-pointer hover:bg-paperDim/60 active:bg-paperDim"
                  >
                    <td className="px-4 py-3 md:py-2 sticky left-0 bg-paper z-10">
                      <span className="inline-block w-3 text-muted">{isOpen ? "▾" : "▸"}</span> {row.category}
                    </td>
                    {months.map((m) => (
                      <td
                        key={m}
                        title={cellTitle(row, m)}
                        className="px-4 py-2 text-right font-mono tabular text-muted"
                      >
                        {row.byMonth[m] ? formatINR(row.byMonth[m]) : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-mono tabular font-medium">{formatINR(row.total)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={months.length + 2} className="px-4 py-3 bg-paperDim/40">
                        <div className="border border-line rounded bg-paper divide-y divide-line">
                          {row.transactions
                            .slice()
                            .sort((a, b) => compareDateTime(b, a))
                            .map((t) => (
                              <div key={t.id} className="px-3 py-2 flex justify-between items-center gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm truncate" title={t.FullDescription || t.Description}>
                                    {t.Description}
                                  </p>
                                  <p className="text-xs text-muted">
                                    {formatDateTime(t)} · {t.Account}
                                  </p>
                                </div>
                                <span className="font-mono tabular text-sm shrink-0">{formatINR(t.Amount)}</span>
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={months.length + 2} className="px-4 py-8 text-center text-muted">
                  No recurring items found yet — nothing has been categorized as rent, EMI, insurance,
                  subscriptions, or bills.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="ledger-rule-strong border-t">
              <td className="px-4 py-2 font-medium text-rust sticky left-0 bg-paper z-10">Total fixed obligations</td>
              {monthTotals.map((v, i) => (
                <td key={months[i]} className="px-4 py-2 text-right font-mono tabular font-medium text-rust">
                  {formatINR(v)}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-mono tabular font-medium text-rust">{formatINR(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
