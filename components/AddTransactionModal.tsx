"use client";

import { useState, type FormEvent } from "react";
import { useLedger } from "@/lib/DataContext";
import { CATEGORY_ORDER } from "@/lib/data";
import type { Category } from "@/lib/categories";
import type { NewTransaction, TransactionType } from "@/lib/types";

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface FormState {
  Date: string;
  Time: string;
  Account: string;
  Description: string;
  Category: Category;
  Type: TransactionType;
  Amount: string;
}

function initialForm(accounts: string[]): FormState {
  return {
    Date: todayISO(),
    Time: nowTimeHHMM(),
    Account: accounts[0] || "",
    Description: "",
    Category: CATEGORY_ORDER[0],
    Type: "Debit",
    Amount: "",
  };
}

export default function AddTransactionModal({ open, onClose }: AddTransactionModalProps) {
  const { addTransaction, balances } = useLedger();
  const accounts = Object.keys(balances);
  const [form, setForm] = useState<FormState>(() => initialForm(accounts));

  if (!open) return null;

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.Description || !form.Amount) return;
    const tx: NewTransaction = {
      ...form,
      Amount: Number(form.Amount),
      Balance: "",
      Subcategory: "",
      FullDescription: "",
    };
    addTransaction(tx);
    setForm(initialForm(accounts));
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4">
      <div className="bg-paper border border-ink rounded max-w-md w-full p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-xl">Log an expense</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm" aria-label="Close">
            Close
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Date</label>
              <input
                type="date"
                value={form.Date}
                onChange={(e) => update("Date", e.target.value)}
                className="w-full border border-line rounded px-2 py-1.5 text-sm bg-paper font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Time</label>
              <input
                type="time"
                value={form.Time}
                onChange={(e) => update("Time", e.target.value)}
                className="w-full border border-line rounded px-2 py-1.5 text-sm bg-paper font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Type</label>
              <select
                value={form.Type}
                onChange={(e) => update("Type", e.target.value as TransactionType)}
                className="w-full border border-line rounded px-2 py-1.5 text-sm bg-paper"
              >
                <option value="Debit">Debit (spend)</option>
                <option value="Credit">Credit (income)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Grocery at Reliance Fresh"
              value={form.Description}
              onChange={(e) => update("Description", e.target.value)}
              className="w-full border border-line rounded px-2 py-1.5 text-sm bg-paper"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Category</label>
              <select
                value={form.Category}
                onChange={(e) => update("Category", e.target.value as Category)}
                className="w-full border border-line rounded px-2 py-1.5 text-sm bg-paper"
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Account</label>
              <select
                value={form.Account}
                onChange={(e) => update("Account", e.target.value)}
                className="w-full border border-line rounded px-2 py-1.5 text-sm bg-paper"
              >
                {accounts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.Amount}
              onChange={(e) => update("Amount", e.target.value)}
              className="w-full border border-line rounded px-2 py-1.5 text-sm bg-paper font-mono"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-forest text-paper rounded py-2 text-sm mt-2 hover:bg-forestDeep transition-colors"
          >
            Save entry
          </button>
        </form>
      </div>
    </div>
  );
}
