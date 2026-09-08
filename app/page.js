"use client";

import { useMemo, useState } from "react";
import { useLedger } from "@/lib/DataContext";
import {
  EXCLUDED_FROM_EXPENSE,
  computeMonthlyNet,
  computeCategoryTotals,
  uniqueMonths,
  monthLabel,
  formatINR,
} from "@/lib/data";
import StatCard from "@/components/StatCard";
import MonthlyTrendChart from "@/components/MonthlyTrendChart";
import CategoryBreakdown from "@/components/CategoryBreakdown";

export default function Dashboard() {
  const { transactions, balances } = useLedger();
  const months = useMemo(() => uniqueMonths(transactions), [transactions]);
  const [selectedMonth, setSelectedMonth] = useState(months[months.length - 1]);

  const totalBalance = Object.values(balances).reduce((s, b) => s + Number(b.balance || 0), 0);

  const monthlyNet = useMemo(() => computeMonthlyNet(transactions), [transactions]);
  const chartData = months.map((m) => ({ month: m, net: Math.round(monthlyNet[m] || 0) }));

  const currentNet = monthlyNet[selectedMonth] || 0;
  const prevMonthIndex = months.indexOf(selectedMonth) - 1;
  const prevNet = prevMonthIndex >= 0 ? monthlyNet[months[prevMonthIndex]] : null;
  const delta = prevNet != null ? currentNet - prevNet : null;

  const categoryTotals = useMemo(
    () => computeCategoryTotals(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => (a.Date < b.Date ? 1 : -1))
        .slice(0, 8),
    [transactions]
  );

  return (
    <div className="px-10 py-8 max-w-5xl">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            {months.length ? `${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}` : ""}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Total balance (both accounts)" value={formatINR(totalBalance)} />
        <StatCard
          label={`Net expense — ${monthLabel(selectedMonth || "")}`}
          value={formatINR(currentNet)}
          accent="#A8452F"
          sub={
            delta != null
              ? `${delta >= 0 ? "+" : ""}${formatINR(delta)} vs ${monthLabel(months[prevMonthIndex])}`
              : undefined
          }
        />
        <StatCard
          label="Transactions logged"
          value={transactions.length.toLocaleString("en-IN")}
          sub={`Across ${Object.keys(balances).length} accounts`}
        />
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl">Monthly spend</h2>
        </div>
        <div className="border border-line rounded bg-paper p-5">
          <MonthlyTrendChart data={chartData} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8">
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-xl">By category</h2>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-paper border border-line rounded px-2 py-1 text-sm font-mono"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="border border-line rounded bg-paper p-5">
            <CategoryBreakdown entries={sortedCategories} excludedSet={EXCLUDED_FROM_EXPENSE} />
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl mb-4">Recent activity</h2>
          <div className="border border-line rounded bg-paper divide-y divide-line">
            {recent.map((tx) => (
              <div key={tx.id} className="px-4 py-3 flex justify-between items-center">
                <div className="min-w-0 pr-3">
                  <p className="text-sm truncate">{tx.Description}</p>
                  <p className="text-xs text-muted">
                    {tx.Date} · {tx.Category}
                  </p>
                </div>
                <span
                  className={`font-mono tabular text-sm shrink-0 ${
                    tx.Type === "Credit" ? "text-forestDeep" : "text-rust"
                  }`}
                >
                  {tx.Type === "Credit" ? "+" : "-"}
                  {formatINR(tx.Amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
