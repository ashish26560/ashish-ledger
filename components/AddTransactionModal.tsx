"use client";

import { useState, type FormEvent } from "react";
import { useLedger } from "@/lib/DataContext";
import Select from "@/components/Select";
import { CATEGORY_ORDER } from "@/lib/data";
import type { Category } from "@/lib/categories";
import type { NewTransaction, TransactionType } from "@/lib/types";

const TYPE_OPTIONS = [
  { value: "Debit", label: "Debit (spend)" },
  { value: "Credit", label: "Credit (income)" },
] as const;

const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => ({ value: c, label: c }));

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
    if (!form.Description || !form.Amount || !form.Account.trim()) return;
    const tx: NewTransaction = {
      ...form,
      Amount: Number(form.Amount),
      Balance: "",
      Subcategory: "",
      Pot: "",
      FullDescription: "",
    };
    addTransaction(tx);
    setForm(initialForm(accounts));
    onClose();
  }

  return (
    // Bottom sheet on phones (reachable, and the keyboard pushes it up
    // naturally), centered dialog from `sm` up.
    <div
      className="fixed inset-0 bg-ink/40 flex items-end sm:items-center justify-center z-50 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Log an expense"
    >
      <div className="bg-paper border border-ink rounded-t-lg sm:rounded max-w-md w-full p-5 sm:p-6 max-h-[92vh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-xl">Log an expense</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm py-1 px-2 -mr-2" aria-label="Close">
            Close
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Date</label>
              <input
                type="date"
                value={form.Date}
                onChange={(e) => update("Date", e.target.value)}
                className="w-full border border-line rounded px-2 py-2 sm:py-1.5 text-sm bg-paper font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Time</label>
              <input
                type="time"
                value={form.Time}
                onChange={(e) => update("Time", e.target.value)}
                className="w-full border border-line rounded px-2 py-2 sm:py-1.5 text-sm bg-paper font-mono"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-muted mb-1">Type</label>
              <Select
                label="Type"
                value={form.Type}
                onChange={(v) => update("Type", v as TransactionType)}
                options={TYPE_OPTIONS}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Grocery at Reliance Fresh"
              value={form.Description}
              onChange={(e) => update("Description", e.target.value)}
              className="w-full border border-line rounded px-2 py-2 sm:py-1.5 text-sm bg-paper"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Category</label>
              <Select
                label="Category"
                value={form.Category}
                onChange={(v) => update("Category", v as Category)}
                options={CATEGORY_OPTIONS}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Account</label>
              {/* On a fresh ledger there are no accounts to pick from yet, and
                  an empty dropdown is a dead end — so type the first one. */}
              {accounts.length === 0 ? (
                <input
                  type="text"
                  placeholder="e.g. HDFC ...9939"
                  value={form.Account}
                  onChange={(e) => update("Account", e.target.value)}
                  className="w-full border border-line rounded px-2 py-2 sm:py-1.5 text-sm bg-paper"
                  required
                />
              ) : (
                <Select
                  label="Account"
                  value={form.Account}
                  onChange={(v) => update("Account", v)}
                  options={accounts.map((a) => ({ value: a, label: a }))}
                  className="w-full"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Amount (₹)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.Amount}
              onChange={(e) => update("Amount", e.target.value)}
              className="w-full border border-line rounded px-2 py-2 sm:py-1.5 text-sm bg-paper font-mono"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-forest text-paper rounded py-3 sm:py-2 text-sm mt-2 hover:bg-forestDeep active:bg-forestDeep transition-colors"
          >
            Save entry
          </button>
        </form>
      </div>
    </div>
  );
}
