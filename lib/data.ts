// Pure derived-data helpers: everything here takes a `Transaction[]` (plus
// maybe a filter) and returns a plain value or object. No I/O, no React —
// easy to unit test and safe to call from either a page or a test file.

import { CATEGORY_ORDER, EXCLUDED_FROM_EXPENSE, type Category } from "@/lib/categories";
import type { Transaction } from "@/lib/types";

export { CATEGORY_ORDER, EXCLUDED_FROM_EXPENSE };

export function categoryRank(cat: Category): number {
  const i = (CATEGORY_ORDER as readonly string[]).indexOf(cat);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

export function formatINR(amount: number | "" | null | undefined, opts: { signed?: boolean } = {}): string {
  const n = Number(amount) || 0;
  const { signed = false } = opts;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const sign = signed ? (n < 0 ? "-" : n > 0 ? "+" : "") : "";
  return `${sign}₹${formatted}`;
}

// monthStr like "2026-06"
export function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function isExpenseRow(tx: Pick<Transaction, "Category">): boolean {
  return !EXCLUDED_FROM_EXPENSE.has(tx.Category);
}

export function computeMonthlyNet(transactions: Transaction[]): Record<string, number> {
  const byMonth: Record<string, number> = {};
  for (const tx of transactions) {
    if (!isExpenseRow(tx)) continue;
    const amt = tx.Type === "Debit" ? Number(tx.Amount) : -Number(tx.Amount);
    // Net expense = debits minus credits within expense categories
    byMonth[tx.Month] = (byMonth[tx.Month] || 0) + amt;
  }
  return byMonth;
}

export function computeCategoryTotals(transactions: Transaction[], monthFilter?: string): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (monthFilter && tx.Month !== monthFilter) continue;
    if (tx.Type !== "Debit") continue;
    totals[tx.Category] = (totals[tx.Category] || 0) + Number(tx.Amount);
  }
  return totals;
}

export function uniqueMonths(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((t) => t.Month))).sort();
}

export function uniqueCategories(transactions: Transaction[]): Category[] {
  return Array.from(new Set(transactions.map((t) => t.Category))).sort(
    (a, b) => categoryRank(a) - categoryRank(b)
  );
}

export function uniqueAccounts(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((t) => t.Account))).sort();
}

// Ascending date+time comparator. Transactions without a Time (all bank-
// statement imports, and older manual entries) sort before timed entries on
// the same day, and otherwise compare by date alone.
export function compareDateTime(a: Pick<Transaction, "Date" | "Time">, b: Pick<Transaction, "Date" | "Time">): number {
  const ak = `${a.Date} ${a.Time || "00:00"}`;
  const bk = `${b.Date} ${b.Time || "00:00"}`;
  return ak < bk ? -1 : ak > bk ? 1 : 0;
}

export function formatDateTime(tx: Pick<Transaction, "Date" | "Time">): string {
  return tx.Time ? `${tx.Date} ${tx.Time}` : tx.Date;
}
