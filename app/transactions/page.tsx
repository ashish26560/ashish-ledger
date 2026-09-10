"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLedger } from "@/lib/DataContext";
import { uniqueMonths, uniqueCategories, uniqueAccounts, monthLabel, formatINR, compareDateTime } from "@/lib/data";
import Select from "@/components/Select";
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

  const monthOptions = useMemo(
    () => [{ value: ALL, label: "All months" }, ...months.map((m) => ({ value: m, label: monthLabel(m) }))],
    [months]
  );
  const categoryOptions = useMemo(
    () => [{ value: ALL, label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))],
    [categories]
  );
  const accountOptions = useMemo(
    () => [{ value: ALL, label: "All accounts" }, ...accounts.map((a) => ({ value: a, label: a }))],
    [accounts]
  );
  const pageSizeOptions = useMemo(
    () => PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) })),
    []
  );

  const selectCls = "w-full md:w-auto";

  return (
    <div className="px-4 md:px-10 py-6 md:py-8">
      <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Transactions</h1>
          <p className="text-sm text-muted mt-1">{filtered.length} entries</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="border border-line rounded px-4 py-2.5 sm:py-2 text-sm hover:bg-paperDim/60 active:bg-paperDim transition-colors"
          >
            Upload statement
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-forest text-paper rounded px-4 py-2.5 sm:py-2 text-sm hover:bg-forestDeep active:bg-forestDeep transition-colors"
          >
            Log an expense
          </button>
        </div>
      </header>

      {/* Two-up on phones so the three dropdowns don't each eat a full row */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3 mb-4 md:mb-5">
        <Select
          label="Month"
          value={month}
          onChange={setMonth}
          options={monthOptions}
          className={selectCls}
        />
        <Select
          label="Category"
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          className={selectCls}
        />
        <Select
          label="Account"
          value={account}
          onChange={setAccount}
          options={accountOptions}
          className={selectCls}
        />
        <input
          type="search"
          inputMode="search"
          placeholder="Search description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search description"
          className="col-span-2 bg-paper border border-line rounded px-3 py-2 md:py-1.5 text-sm md:flex-1 md:min-w-[180px]"
        />
      </div>

      <TransactionsTable rows={paginated} />

      {/* On phones the filtered total gets its own full-width row above the
          pager — it's the number worth reading, and it would otherwise be
          crushed against the Next button. */}
      <div className="flex items-baseline justify-between gap-3 mt-4 md:hidden border-t border-line pt-3">
        <span className="text-sm text-muted">Total (filtered)</span>
        <span className={`font-mono tabular text-lg ${total < 0 ? "text-rust" : "text-forestDeep"}`}>
          {formatINR(total, { signed: true })}
        </span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-3 md:pr-2">
        <div className="flex items-center justify-between md:justify-start gap-2 md:gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="border border-line rounded px-4 py-2.5 md:px-3 md:py-1.5 text-sm hover:bg-paperDim/60 active:bg-paperDim transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Previous
          </button>
          <span className="text-xs md:text-sm text-muted text-center">
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
            className="border border-line rounded px-4 py-2.5 md:px-3 md:py-1.5 text-sm hover:bg-paperDim/60 active:bg-paperDim transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Next
          </button>
        </div>

        <div className="flex items-center justify-between md:justify-start gap-3 md:gap-6">
          <label className="flex items-center gap-2 text-sm text-muted">
            Rows per page
            <Select
              label="Rows per page"
              value={String(pageSize)}
              onChange={(v) => setPageSize(Number(v))}
              options={pageSizeOptions}
              align="right"
              className="w-[72px]"
            />
          </label>

          <div className="hidden md:flex items-baseline gap-3">
            <span className="text-sm text-muted">Total (filtered)</span>
            <span className={`font-mono tabular text-lg ${total < 0 ? "text-rust" : "text-forestDeep"}`}>
              {formatINR(total, { signed: true })}
            </span>
          </div>
        </div>
      </div>

      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ImportStatementModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
