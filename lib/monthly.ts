// Per-month rollups for the Monthly page.
//
// Everything here is pure: `Transaction[]` in, plain objects out. The page
// renders these straight, so all of the "what counts as spending" decisions
// live in this one file rather than being scattered through JSX.
//
// The rules, once, in plain English:
//
//   * Money moved between your own accounts is not spending and not income.
//     It's excluded from every figure below and reported separately as
//     `selfTransferTotal`, so a month that only shuffled money doesn't look
//     like a month that spent it.
//   * `spent` is every remaining debit. Not "debits in expense categories" —
//     a payment to a person is still money that left the account, and the
//     point of this page is reconciling against the bank's own balance.
//   * `salary` and `otherIn` split the credits, because "I earned it" and
//     "someone paid me back" answer different questions.
//   * A shared pot speaks for its own transactions. Money you fronted for a
//     group and money someone sent you to spend on their behalf are both
//     replaced by what the pot actually cost you; the rest shows up as money
//     you're holding for other people. See lib/pots.ts.
//   * `net` is what the month did to your savings: positive added, negative
//     drew down. It should equal the change in your combined balance — and it
//     still does with pots in play, because a pot only moves an amount between
//     `spent` and `otherIn`, never out of the arithmetic.

import { formatINR, monthLabel } from "@/lib/data";
import { potAdjustment, splitByPot, type Pot } from "@/lib/pots";
import type { Category } from "@/lib/categories";
import type { Transaction } from "@/lib/types";

export const SELF_TRANSFER: Category = "Self Transfer";
export const SALARY: Category = "Income - Salary";

/** A payment has to clear this to make the "biggest payments" list. */
export const BIG_PAYMENT_FLOOR = 2000;
const BIG_PAYMENT_LIMIT = 10;
/** Shown when nothing in the month clears the floor. */
const SMALL_MONTH_FALLBACK = 5;
const OTHER_IN_LIMIT = 6;

export interface AccountSplit {
  account: string;
  spent: number;
  received: number;
  /** Number of payments out — not credits, which are counted by `received`. */
  count: number;
}

export interface MonthSummary {
  /** "YYYY-MM". */
  month: string;
  /** "Aug 2026". */
  label: string;
  spent: number;
  salary: number;
  otherIn: number;
  /** salary + otherIn − spent. Positive added to savings. */
  net: number;
  /** Payments out, self-transfers excluded. Pot payments are counted: they happened. */
  txnCount: number;
  /** Pots active this month, and what they contributed. */
  pots: Pot[];
  /** Of `spent`, how much came from pots rather than ordinary payments. */
  potCost: number;
  /** Money that arrived this month and belongs to someone else. */
  potHeld: number;
  accounts: AccountSplit[];
  /** [category, total] for debits, biggest first. */
  categories: [string, number][];
  topPayments: Transaction[];
  otherInItems: Transaction[];
  selfTransferTotal: number;
}

function isSelfTransfer(tx: Transaction): boolean {
  return tx.Category === SELF_TRANSFER;
}

function byAmountDesc(a: Transaction, b: Transaction): number {
  return Number(b.Amount) - Number(a.Amount);
}

function summariseMonth(month: string, rows: Transaction[], accounts: string[]): MonthSummary {
  const real = rows.filter((t) => !isSelfTransfer(t));
  const debits = real.filter((t) => t.Type === "Debit");

  const sum = (xs: Transaction[]) => xs.reduce((s, t) => s + Number(t.Amount || 0), 0);

  // Rows a pot speaks for are set aside and replaced by the pot's own
  // figures; everything else counts at face value.
  const { loose } = splitByPot(real);
  const adjustment = potAdjustment(real);
  const looseDebits = loose.filter((t) => t.Type === "Debit");
  const looseCredits = loose.filter((t) => t.Type === "Credit");

  const salaryRows = looseCredits.filter((t) => t.Category === SALARY);
  const otherInRows = looseCredits.filter((t) => t.Category !== SALARY);

  const spent = sum(looseDebits) + adjustment.cost;
  const salary = sum(salaryRows);
  const otherIn = sum(otherInRows) + adjustment.held;

  const categoryTotals: Record<string, number> = {};
  for (const t of looseDebits) {
    categoryTotals[t.Category] = (categoryTotals[t.Category] || 0) + Number(t.Amount || 0);
  }
  for (const [category, amount] of adjustment.costByCategory) {
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
  }

  const ranked = debits.slice().sort(byAmountDesc);
  const overFloor = ranked.filter((t) => Number(t.Amount) >= BIG_PAYMENT_FLOOR);
  // A quiet month with nothing over the floor would otherwise render an empty
  // panel, which reads as "no data" rather than "nothing big happened".
  const topPayments = overFloor.length
    ? overFloor.slice(0, BIG_PAYMENT_LIMIT)
    : ranked.slice(0, SMALL_MONTH_FALLBACK);

  return {
    month,
    label: monthLabel(month),
    spent,
    salary,
    otherIn,
    net: salary + otherIn - spent,
    txnCount: debits.length,
    pots: adjustment.pots,
    potCost: adjustment.cost,
    potHeld: adjustment.held,
    // Pot cost and held are attributed to the account of the pot's largest
    // payment, so these rows still add up to `spent` and to the money in.
    accounts: accounts.map((account) => {
      const mine = loose.filter((t) => t.Account === account);
      return {
        account,
        spent: sum(mine.filter((t) => t.Type === "Debit")) + (adjustment.costByAccount.get(account) ?? 0),
        received: sum(mine.filter((t) => t.Type === "Credit")) + (adjustment.heldByAccount.get(account) ?? 0),
        count: debits.filter((t) => t.Account === account).length,
      };
    }),
    categories: Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]),
    topPayments,
    otherInItems: otherInRows.slice().sort(byAmountDesc).slice(0, OTHER_IN_LIMIT),
    selfTransferTotal: sum(rows.filter((t) => isSelfTransfer(t) && t.Type === "Debit")),
  };
}

/**
 * One summary per month present in `transactions`, oldest first.
 *
 * `accounts` fixes the order of the per-month account split so the two rows
 * don't swap places as you click between months.
 */
export function buildMonthSummaries(transactions: Transaction[], accounts: string[]): MonthSummary[] {
  const byMonth = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const list = byMonth.get(tx.Month);
    if (list) list.push(tx);
    else byMonth.set(tx.Month, [tx]);
  }
  return Array.from(byMonth.keys())
    .sort()
    .map((month) => summariseMonth(month, byMonth.get(month)!, accounts));
}

/**
 * Keeps the biggest `keep` categories and folds the rest into one row, so a
 * long tail of ₹40 categories can't bury the four that matter. The folded row
 * is returned separately because it is a sum, not a category, and shouldn't be
 * drawn as a bar next to real ones.
 */
export function foldCategoryTail(
  categories: [string, number][],
  keep = 8
): { head: [string, number][]; tail: { count: number; total: number } | null } {
  if (categories.length <= keep) return { head: categories, tail: null };
  const head = categories.slice(0, keep);
  const rest = categories.slice(keep);
  return {
    head,
    tail: { count: rest.length, total: rest.reduce((s, [, v]) => s + v, 0) },
  };
}

/** "₹15,690.46" with an explicit + or −, for the month's headline figure. */
export function formatSignedINR(amount: number): string {
  return `${amount < 0 ? "−" : "+"}${formatINR(Math.abs(amount))}`;
}
