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
  compareDateTime,
  formatDateTime,
} from "@/lib/data";
import Select from "@/components/Select";
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

  const categoryTotals = useMemo(() => computeCategoryTotals(transactions, selectedMonth), [transactions, selectedMonth]);
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  const monthOptions = useMemo(() => months.map((m) => ({ value: m, label: monthLabel(m) })), [months]);

  const recent = useMemo(
    () =>
      transactions
        .filter((t) => t.Month === selectedMonth)
        .sort((a, b) => compareDateTime(b, a))
        .slice(0, 8),
    [transactions, selectedMonth]
  );

  return (
    <div className="px-4 md:px-10 py-6 md:py-8 max-w-5xl">
      <header className="flex items-baseline justify-between mb-6 md:mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            {months.length ? `${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}` : ""}
          </p>
        </div>
      </header>

      {/* Balance and net expense side by side on phones (they're the pair you
          compare); the transaction count spans underneath. */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10">
        <StatCard label="Total balance (both accounts)" value={formatINR(totalBalance)} />
        <StatCard
          label={`Net expense — ${monthLabel(selectedMonth || "")}`}
          value={formatINR(currentNet)}
          accent="#A8452F"
          sub={
            delta != null ? `${delta >= 0 ? "+" : ""}${formatINR(delta)} vs ${monthLabel(months[prevMonthIndex])}` : undefined
          }
        />
        <div className="col-span-2 md:col-span-1">
          <StatCard
            label="Transactions logged"
            value={transactions.length.toLocaleString("en-IN")}
            sub={`Across ${Object.keys(balances).length} accounts`}
          />
        </div>
      </section>

      <section className="mb-8 md:mb-10">
        <div className="flex items-baseline justify-between mb-3 md:mb-4">
          <h2 className="font-display text-lg md:text-xl">Monthly spend</h2>
        </div>
        <div className="border border-line rounded bg-paper p-3 md:p-5">
          <MonthlyTrendChart data={chartData} />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="flex items-baseline justify-between mb-3 md:mb-4">
            <h2 className="font-display text-lg md:text-xl">By category</h2>
            <Select
              label="Month"
              value={selectedMonth ?? ""}
              onChange={setSelectedMonth}
              options={monthOptions}
              align="right"
              className="font-mono"
            />
          </div>
          <div className="border border-line rounded bg-paper p-4 md:p-5">
            <CategoryBreakdown entries={sortedCategories} excludedSet={EXCLUDED_FROM_EXPENSE} />
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg md:text-xl mb-3 md:mb-4">
            Recent activity — {monthLabel(selectedMonth || "")}
          </h2>
          <div className="border border-line rounded bg-paper divide-y divide-line">
            {recent.map((tx) => (
              <div key={tx.id} className="px-4 py-3 flex justify-between items-center">
                <div className="min-w-0 pr-3">
                  <p className="text-sm truncate" title={tx.FullDescription || tx.Description}>
                    {tx.Description}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(tx)} · {tx.Category}
                  </p>
                </div>
                <span
                  className={`font-mono tabular text-sm shrink-0 ${tx.Type === "Credit" ? "text-forestDeep" : "text-rust"}`}
                >
                  {tx.Type === "Credit" ? "+" : "-"}
                  {formatINR(tx.Amount)}
                </span>
              </div>
            ))}
            {recent.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No activity this month.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
