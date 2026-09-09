"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLedger } from "@/lib/DataContext";
import { uniqueMonths, uniqueCategories, uniqueAccounts, monthLabel, formatINR, compareDateTime } from "@/lib/data";
import TransactionsTable from "@/components/TransactionsTable";
import AddTransactionModal from "@/components/AddTransactionModal";
import ImportStatementModal from "@/components/ImportStatementModal";

const ALL = "All";
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 15;

export default function TransactionsPage() {
  const { transactions } = useLedger();
  const months = useMemo(() => uniqueMonths(transactions), [transactions]);
  const categories = useMemo(() => uniqueCategories(transactions), [transactions]);
  const accounts = useMemo(() => uniqueAccounts(transactions), [transactions]);

  const [month, setMonth] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [account, setAccount] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Default to the most recent month once the ledger first loads, rather
  // than opening on "All months" (600+ rows). Only fires once — after that,
  // the user's own choice (including picking "All months" back) sticks.
  const defaultedMonth = useRef(false);
  useEffect(() => {
    if (!defaultedMonth.current && months.length > 0) {
      setMonth(months[months.length - 1]);
      defaultedMonth.current = true;
    }
  }, [months]);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => (month === ALL ? true : t.Month === month))
      .filter((t) => (category === ALL ? true : t.Category === category))
      .filter((t) => (account === ALL ? true : t.Account === account))
      .filter((t) => (search ? t.Description.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => compareDateTime(b, a));
  }, [transactions, month, category, account, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Any filter change (or the list shrinking, e.g. after a delete) can make
  // the current page number no longer valid — snap it back into range
  // instead of showing an empty page.
  useEffect(() => {
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [month, category, account, search, pageSize]);

  const pageStart = (page - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const total = filtered.reduce((s, t) => {
    const amt = Number(t.Amount) || 0;
    return s + (t.Type === "Credit" ? amt : -amt);
  }, 0);

  const selectCls = "bg-paper border border-line rounded px-2 py-1.5 text-sm";

  return (
    <div className="px-10 py-8">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl">Transactions</h1>
          <p className="text-sm text-muted mt-1">{filtered.length} entries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="border border-line rounded px-4 py-2 text-sm hover:bg-paperDim/60 transition-colors"
          >
            Upload statement
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-forest text-paper rounded px-4 py-2 text-sm hover:bg-forestDeep transition-colors"
          >
            Log an expense
          </button>
        </div>
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
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
          <option value={ALL}>All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={account} onChange={(e) => setAccount(e.target.value)} className={selectCls}>
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

      <TransactionsTable rows={paginated} />

      <div className="flex items-center justify-between mt-3 pr-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="border border-line rounded px-3 py-1.5 text-sm hover:bg-paperDim/60 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Previous
          </button>
          <span className="text-sm text-muted">
            Page {page} of {totalPages}
            {filtered.length > 0 && (
              <>
                {" "}
                · {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length}
              </>
            )}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="border border-line rounded px-3 py-1.5 text-sm hover:bg-paperDim/60 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Next
          </button>
          <label className="flex items-center gap-2 text-sm text-muted ml-2">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-paper border border-line rounded px-2 py-1 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-muted">Total (filtered)</span>
          <span className={`font-mono tabular text-lg ${total < 0 ? "text-rust" : "text-forestDeep"}`}>
            {formatINR(total, { signed: true })}
          </span>
        </div>
      </div>

      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ImportStatementModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
