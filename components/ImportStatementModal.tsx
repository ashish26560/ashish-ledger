"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useLedger } from "@/lib/DataContext";
import Select from "@/components/Select";
import { CATEGORY_ORDER, formatDate, formatINR, uniqueAccounts } from "@/lib/data";
import { parseStatementFile } from "@/lib/statementParser";
import { categorizeAll } from "@/lib/categorize";
import type { Category } from "@/lib/categories";
import type { ImportRow, NewTransaction, ParsedStatement } from "@/lib/types";

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => ({ value: c, label: c }));

interface ImportStatementModalProps {
  open: boolean;
  onClose: () => void;
}

type Stage = "pick" | "error" | "preview" | "done";

export default function ImportStatementModal({ open, onClose }: ImportStatementModalProps) {
  const { transactions, addTransactions, isDuplicateTransaction, updateBalance } = useLedger();
  const existingAccounts = useMemo(() => uniqueAccounts(transactions), [transactions]);

  const [stage, setStage] = useState<Stage>("pick");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParsedStatement | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [updateBalanceOnImport, setUpdateBalanceOnImport] = useState(true);
  const [importedCount, setImportedCount] = useState(0);

  function reset() {
    setStage("pick");
    setError("");
    setResult(null);
    setRows([]);
    setImportedCount(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage("pick");
    setError("");
    try {
      const parsed = await parseStatementFile(file, existingAccounts);
      if (!parsed.transactions.length) {
        setError("No transaction rows found in this file.");
        setStage("error");
        return;
      }
      const categorized = categorizeAll(parsed.transactions, transactions);
      const withDupes: ImportRow[] = categorized.map((tx) => ({
        ...tx,
        include: !isDuplicateTransaction(tx),
        duplicate: isDuplicateTransaction(tx),
      }));
      setResult(parsed);
      setRows(withDupes);
      setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't parse this file.");
      setStage("error");
    }
    e.target.value = "";
  }

  function updateRow(idx: number, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function toggleAll(include: boolean) {
    setRows((prev) => prev.map((r) => (r.duplicate ? r : { ...r, include })));
  }

  const toImport = rows.filter((r) => r.include);
  const dupeCount = rows.filter((r) => r.duplicate).length;
  const reviewCount = rows.filter((r) => r.confidence === "fallback" && r.include).length;

  function handleImport() {
    const cleaned: NewTransaction[] = toImport.map(({ RawNarration, include, duplicate, confidence, category, Balance, ...tx }) => ({
      ...tx,
      Category: category,
      Time: "",
      Balance: Balance == null ? "" : Balance,
      // The full, untruncated bank narration — kept alongside the cleaned
      // Description so a hover tooltip can show the whole detail later,
      // instead of throwing it away once categorization is done with it.
      FullDescription: RawNarration,
    }));
    addTransactions(cleaned);
    if (updateBalanceOnImport && result?.closingBalance != null && result?.account) {
      updateBalance(result.account, result.closingBalance, result.closingDate || new Date().toISOString().slice(0, 10));
    }
    setImportedCount(cleaned.length);
    setStage("done");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-ink/40 flex items-end sm:items-center justify-center z-50 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upload a statement"
    >
      <div className="bg-paper border border-ink rounded-t-lg sm:rounded max-w-3xl w-full p-4 sm:p-6 h-[92vh] sm:h-auto sm:max-h-[85vh] flex flex-col">
        <div className="flex items-baseline justify-between mb-4 shrink-0">
          <h2 className="font-display text-lg sm:text-xl">Upload a statement</h2>
          <button onClick={handleClose} className="text-muted hover:text-ink text-sm py-1 px-2 -mr-2" aria-label="Close">
            Close
          </button>
        </div>

        {stage === "pick" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Upload the .xls/.xlsx statement export from HDFC or SBI net banking. Transactions are
              parsed, categorized to match how the rest of your ledger is categorized, and checked
              against what&apos;s already here before anything is added.
            </p>
            <label className="block border border-dashed border-line rounded p-8 text-center cursor-pointer hover:bg-paperDim/60 transition-colors">
              <input type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={handleFile} />
              <span className="text-sm text-muted">Click to choose a statement file</span>
            </label>
          </div>
        )}

        {stage === "error" && (
          <div className="space-y-4">
            <div className="border border-rust/40 bg-rust/5 text-rust rounded p-4 text-sm">{error}</div>
            <label className="block border border-dashed border-line rounded p-6 text-center cursor-pointer hover:bg-paperDim/60 transition-colors">
              <input type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={handleFile} />
              <span className="text-sm text-muted">Try another file</span>
            </label>
          </div>
        )}

        {stage === "preview" && result && (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="shrink-0 mb-3 text-xs sm:text-sm text-muted flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span>
                <span className="text-ink">{result.bank}</span> · {result.account}
                {result.isNewAccount && <span className="text-gold"> (new account)</span>}
              </span>
              <span>{rows.length} transactions found</span>
              {dupeCount > 0 && <span>{dupeCount} already in your ledger, skipped</span>}
              {reviewCount > 0 && <span className="text-gold">{reviewCount} categorized as a guess — worth a look</span>}
            </div>

            <div className="flex gap-3 mb-2 shrink-0">
              <button onClick={() => toggleAll(true)} className="text-xs text-forestDeep hover:underline">
                Select all
              </button>
              <button onClick={() => toggleAll(false)} className="text-xs text-muted hover:underline">
                Select none
              </button>
            </div>

            <div className="border border-line rounded overflow-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-paperDim">
                  <tr className="ledger-rule-strong text-left text-xs text-muted">
                    <th className="px-3 py-2 font-normal w-8"></th>
                    <th className="px-3 py-2 font-normal hidden sm:table-cell">Date</th>
                    <th className="px-3 py-2 font-normal">Description</th>
                    <th className="px-3 py-2 font-normal hidden sm:table-cell">Category</th>
                    <th className="px-3 py-2 font-normal text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={
                        r.duplicate ? "opacity-40" : r.confidence === "fallback" ? "bg-gold/10" : "hover:bg-paperDim/60"
                      }
                    >
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={r.include}
                          disabled={r.duplicate}
                          onChange={(e) => updateRow(idx, { include: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-1.5 font-mono tabular text-xs text-muted whitespace-nowrap hidden sm:table-cell">
                        {formatDate(r.Date)}
                      </td>
                      <td className="px-3 py-2 sm:py-1.5 max-w-[160px] sm:max-w-[220px]" title={r.RawNarration}>
                        <span className="block truncate">{r.Description}</span>
                        {r.duplicate && <span className="text-muted text-xs">already imported</span>}
                        <span className="sm:hidden block font-mono tabular text-[11px] text-muted mt-0.5">
                          {formatDate(r.Date)}
                        </span>
                        {/* The category picker has no column of its own on a
                            phone, so it sits with the row it belongs to. */}
                        <span className="sm:hidden block mt-1">
                          <Select
                            label={`Category for ${r.Description}`}
                            value={r.category}
                            disabled={r.duplicate}
                            onChange={(v) => updateRow(idx, { category: v as Category, confidence: "manual" })}
                            options={CATEGORY_OPTIONS}
                            className="max-w-full bg-paperDim"
                          />
                        </span>
                      </td>
                      <td className="px-3 py-1.5 hidden sm:table-cell">
                        <Select
                          label={`Category for ${r.Description}`}
                          value={r.category}
                          disabled={r.duplicate}
                          onChange={(v) => updateRow(idx, { category: v as Category, confidence: "manual" })}
                          options={CATEGORY_OPTIONS}
                          className="w-full max-w-[170px] bg-transparent border-transparent hover:border-line"
                        />
                      </td>
                      <td
                        className={`px-3 py-2 sm:py-1.5 text-right font-mono tabular whitespace-nowrap align-top sm:align-middle ${
                          r.Type === "Credit" ? "text-forestDeep" : "text-ink"
                        }`}
                      >
                        {r.Type === "Credit" ? "+" : "-"}
                        {formatINR(r.Amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 pt-3 sm:pt-4 mt-1 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-[env(safe-area-inset-bottom)] sm:pb-0">
              <label className="flex items-center gap-2 text-sm text-muted">
                {result.closingBalance != null && (
                  <>
                    <input
                      type="checkbox"
                      checked={updateBalanceOnImport}
                      onChange={(e) => setUpdateBalanceOnImport(e.target.checked)}
                    />
                    Update {result.account} balance to {formatINR(result.closingBalance)}
                  </>
                )}
              </label>
              <button
                onClick={handleImport}
                disabled={toImport.length === 0}
                className="bg-forest text-paper rounded px-4 py-3 sm:py-2 text-sm hover:bg-forestDeep active:bg-forestDeep transition-colors disabled:opacity-40 w-full sm:w-auto"
              >
                Import {toImport.length} transaction{toImport.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-4">
            <div className="border border-forest/30 bg-forest/5 text-forestDeep rounded p-4 text-sm">
              Added {importedCount} transaction{importedCount === 1 ? "" : "s"} to your ledger.
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="border border-line rounded px-4 py-2.5 sm:py-1.5 text-sm hover:bg-paperDim/60 active:bg-paperDim transition-colors"
              >
                Upload another
              </button>
              <button
                onClick={handleClose}
                className="bg-ink text-paper rounded px-4 py-2.5 sm:py-1.5 text-sm hover:bg-forestDeep active:bg-forestDeep transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
