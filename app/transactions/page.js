"use client";

import { useMemo, useState } from "react";
import { useLedger } from "@/lib/DataContext";
import {
  uniqueMonths,
  uniqueCategories,
  uniqueAccounts,
  monthLabel,
  formatINR,
} from "@/lib/data";
import TransactionsTable from "@/components/TransactionsTable";
import AddTransactionModal from "@/components/AddTransactionModal";

const ALL = "All";

export default function TransactionsPage() {
  const { transactions } = useLedger();
  const months = useMemo(() => uniqueMonths(transactions), [transactions]);
  const categories = useMemo(() => uniqueCategories(transactions), [transactions]);
  const accounts = useMemo(() => uniqueAccounts(transactions), [transactions]);

  const [month, setMonth] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [account, setAccount] = useState(ALL);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => (month === ALL ? true : t.Month === month))
      .filter((t) => (category === ALL ? true : t.Category === category))
      .filter((t) => (account === ALL ? true : t.Account === account))
      .filter((t) =>
        search ? t.Description.toLowerCase().includes(search.toLowerCase()) : true
      )
      .sort((a, b) => (a.Date < b.Date ? 1 : -1));
  }, [transactions, month, category, account, search]);

  const total = filtered.reduce((s, t) => {
    const amt = Number(t.Amount) || 0;
    return s + (t.Type === "Credit" ? amt : -amt);
  }, 0);

  const selectCls =
    "bg-paper border border-line rounded px-2 py-1.5 text-sm";

  return (
    <div className="px-10 py-8">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl">Transactions</h1>
          <p className="text-sm text-muted mt-1">{filtered.length} entries</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-forest text-paper rounded px-4 py-2 text-sm hover:bg-forestDeep transition-colors"
        >
          Log an expense
        </button>
      </header>

      <div className="flex flex-wrap gap-3 mb-5">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls}>
          <option value={ALL}>All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectCls}
        >
          <option value={ALL}>All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className={selectCls}
        >
          <option value={ALL}>All accounts</option>
          {accounts.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-paper border border-line rounded px-3 py-1.5 text-sm flex-1 min-w-[180px]"
        />
      </div>

      <TransactionsTable rows={filtered} />

      <div className="flex justify-end mt-3 pr-2">
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-muted">Total (filtered)</span>
          <span
            className={`font-mono tabular text-lg ${
              total < 0 ? "text-rust" : "text-forestDeep"
            }`}
          >
            {formatINR(total, { signed: true })}
          </span>
        </div>
      </div>

      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
