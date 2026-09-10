"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { compareDateTime } from "@/lib/data";
import * as api from "@/lib/api-client";
import type { BalancesByAccount, EditableTransactionFields, NewTransaction, Transaction } from "@/lib/types";

export interface LedgerContextValue {
  transactions: Transaction[];
  balances: BalancesByAccount;
  addTransaction: (tx: NewTransaction) => void;
  addTransactions: (txs: NewTransaction[]) => void;
  isDuplicateTransaction: (tx: Pick<Transaction, "Date" | "Account" | "Type" | "Amount" | "Description">) => boolean;
  updateTransaction: (id: string, patch: EditableTransactionFields) => void;
  deleteTransaction: (id: string) => void;
  updateBalance: (account: string, balance: number, asOf: string) => void;
  loaded: boolean;
  loadError: string | null;
}

const DataContext = createContext<LedgerContextValue | null>(null);

function signature(tx: Pick<Transaction, "Date" | "Account" | "Type" | "Amount" | "Description">): string {
  return `${tx.Date}|${tx.Account}|${tx.Type}|${tx.Amount}|${tx.Description}`;
}

// Transactions and balances now live in Postgres (see db/schema.sql and the
// app/api/* route handlers) instead of each browser's own localStorage, so
// every device sees the same ledger. This provider's job is to fetch that
// once on load, then keep the API in sync as the user edits things —
// everything below it (pages, modals, the table) is unchanged and still
// just calls useLedger() the same way it always did.
export function DataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<BalancesByAccount>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [txData, balData] = await Promise.all([api.fetchTransactions(), api.fetchBalances()]);
        if (cancelled) return;
        setTransactions(txData);
        setBalances(balData);
      } catch (err) {
        // A 401 means the session expired while the tab sat open. Bounce to
        // sign-in rather than showing a "couldn't load" error the user can do
        // nothing about.
        if (err instanceof api.ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        console.error("Failed to load ledger data:", err);
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load ledger data.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Used by the statement-import preview to grey out rows already in the
  // ledger — same signature the API itself doesn't enforce uniquely (real
  // same-day/same-amount transactions can collide), so this is a "looks like
  // a duplicate" check, not a hard guarantee.
  const existingSignatures = useMemo(() => new Set(transactions.map(signature)), [transactions]);

  const isDuplicateTransaction = useCallback(
    (tx: Pick<Transaction, "Date" | "Account" | "Type" | "Amount" | "Description">) =>
      existingSignatures.has(signature(tx)),
    [existingSignatures]
  );

  const addTransaction = useCallback((tx: NewTransaction) => {
    // Fire-and-forget from the caller's point of view (the modal closes
    // immediately, same as before) — the new row appears once the server
    // confirms it, a beat later.
    api
      .createTransactions([tx])
      .then(({ inserted }) => {
        setTransactions((prev) => [...prev, ...inserted].sort(compareDateTime));
      })
      .catch((err: unknown) => {
        console.error("addTransaction failed:", err);
        alert(`Couldn't save that entry: ${err instanceof Error ? err.message : String(err)}`);
      });
  }, []);

  // Bulk-add, used by statement import. The caller has already decided which
  // rows to send (the preview screen's "include" checkboxes), so this just
  // inserts them.
  const addTransactions = useCallback((txs: NewTransaction[]) => {
    if (!txs || !txs.length) return;
    api
      .createTransactions(txs)
      .then(({ inserted }) => {
        setTransactions((prev) => [...prev, ...inserted].sort(compareDateTime));
      })
      .catch((err: unknown) => {
        console.error("addTransactions failed:", err);
        alert(`Couldn't save the imported transactions: ${err instanceof Error ? err.message : String(err)}`);
      });
  }, []);

  const updateTransaction = useCallback((id: string, patch: EditableTransactionFields) => {
    // Optimistic: the category dropdown should feel instant. If the save
    // fails we don't roll it back automatically — we just tell you, since a
    // silent failure on financial data is worse than a noisy one.
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    api.patchTransaction(id, patch).catch((err: unknown) => {
      console.error("updateTransaction failed:", err);
      alert(`That change may not have saved: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    api.deleteTransaction(id).catch((err: unknown) => {
      console.error("deleteTransaction failed:", err);
      alert(`That delete may not have saved: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, []);

  const updateBalance = useCallback((account: string, balance: number, asOf: string) => {
    setBalances((prev) => ({ ...prev, [account]: { balance, asOf } }));
    api.putBalance(account, balance, asOf).catch((err: unknown) => {
      console.error("updateBalance failed:", err);
      alert(`That balance update may not have saved: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, []);

  const value = useMemo<LedgerContextValue>(
    () => ({
      transactions,
      balances,
      addTransaction,
      addTransactions,
      isDuplicateTransaction,
      updateTransaction,
      deleteTransaction,
      updateBalance,
      loaded,
      loadError,
    }),
    [
      transactions,
      balances,
      addTransaction,
      addTransactions,
      isDuplicateTransaction,
      updateTransaction,
      deleteTransaction,
      updateBalance,
      loaded,
      loadError,
    ]
  );

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-muted text-sm px-6 text-center">
        {loadError ? `Couldn't load your ledger: ${loadError} — try reloading the page.` : "Loading your ledger…"}
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useLedger must be used within DataProvider");
  return ctx;
}
