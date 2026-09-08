"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import seedTransactions from "@/data/transactions.json";

const STORAGE_KEY = "ledger:transactions:v1";
const BALANCE_KEY = "ledger:balances:v1";

const DEFAULT_BALANCES = {
  "HDFC ...9939": { balance: 24424.11, asOf: "2026-09-07" },
  "SBI ...1933": { balance: 76215.79, asOf: "2026-09-07" },
};

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [transactions, setTransactions] = useState(seedTransactions);
  const [balances, setBalances] = useState(DEFAULT_BALANCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const rawBal = window.localStorage.getItem(BALANCE_KEY);
      if (raw) setTransactions(JSON.parse(raw));
      if (rawBal) setBalances(JSON.parse(rawBal));
    } catch (e) {
      // ignore corrupted storage, fall back to seed
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      /* storage full or unavailable */
    }
  }, [transactions, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(BALANCE_KEY, JSON.stringify(balances));
    } catch (e) {
      /* ignore */
    }
  }, [balances, loaded]);

  const addTransaction = useCallback((tx) => {
    setTransactions((prev) => {
      const id = `t${Date.now()}`;
      const month = tx.Date.slice(0, 7);
      const next = { ...tx, id, Month: month };
      return [...prev, next].sort((a, b) => (a.Date < b.Date ? -1 : 1));
    });
  }, []);

  const updateTransaction = useCallback((id, patch) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const deleteTransaction = useCallback((id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateBalance = useCallback((account, balance, asOf) => {
    setBalances((prev) => ({ ...prev, [account]: { balance, asOf } }));
  }, []);

  const resetToSeed = useCallback(() => {
    setTransactions(seedTransactions);
    setBalances(DEFAULT_BALANCES);
  }, []);

  const value = useMemo(
    () => ({
      transactions,
      balances,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      updateBalance,
      resetToSeed,
      loaded,
    }),
    [transactions, balances, addTransaction, updateTransaction, deleteTransaction, updateBalance, resetToSeed, loaded]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useLedger must be used within DataProvider");
  return ctx;
}
