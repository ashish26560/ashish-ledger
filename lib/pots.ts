// Shared pots: money that passes through the account without being yours.
//
// Two shapes, one mechanism. You front a group dinner (₹9,000 out) and people
// pay you back (₹8,000 in) — your cost was ₹1,000. Or someone sends you money
// (₹20,000 in) and you make the booking with it (₹16,443 out) — your cost was
// nothing, and you are holding ₹3,557 that isn't yours. Give the related rows
// the same pot name and both fall out of one subtraction.
//
// Two rules keep this honest:
//
//  1. A pot never makes a category negative. If more came in than went out,
//     the excess isn't a discount on your groceries — it's someone else's
//     money sitting in your account, and it's reported as `held`.
//
//  2. Month figures stay true to the bank. A pot is measured within a month,
//     not across its whole life, so `salary + otherIn − spent = net` still
//     reconciles to what the statement says happened that month. A pot whose
//     repayments land in a later month therefore reads as full cost in the
//     first month and money back in the second — which is what the account
//     actually did. `buildPots` gives the lifetime view for the whole story.

import type { Transaction } from "@/lib/types";

export interface Pot {
  name: string;
  /** Total debits tagged with this pot. */
  out: number;
  /** Total credits tagged with this pot. */
  in: number;
  /** What the pot actually cost you: `out − in`, floored at zero. */
  cost: number;
  /** Money of other people's you're still sitting on: `in − out`, floored at zero. */
  held: number;
  /** Category the cost is booked under — the pot's largest single payment. */
  category: string;
  /**
   * Account the cost is booked against, likewise taken from the largest
   * payment. Without this the per-account split would stop adding up to the
   * month's spend the moment a pot netted anything off.
   */
  account: string;
  /** Oldest and newest transaction in the pot, as ISO dates. */
  firstDate: string;
  lastDate: string;
  /** Months this pot has transactions in, oldest first. */
  months: string[];
  transactions: Transaction[];
}

export function potNameOf(tx: Transaction): string {
  return (tx.Pot || "").trim();
}

export function isInPot(tx: Transaction): boolean {
  return potNameOf(tx) !== "";
}

function amountOf(tx: Transaction): number {
  return Number(tx.Amount) || 0;
}

function summarise(name: string, transactions: Transaction[]): Pot {
  let out = 0;
  let inn = 0;
  let biggestPayment: Transaction | null = null;

  for (const tx of transactions) {
    if (tx.Type === "Debit") {
      out += amountOf(tx);
      if (!biggestPayment || amountOf(tx) > amountOf(biggestPayment)) biggestPayment = tx;
    } else {
      inn += amountOf(tx);
    }
  }

  const dates = transactions.map((t) => t.Date).sort();
  const net = out - inn;
  const anchor = biggestPayment ?? transactions[0];

  return {
    name,
    out,
    in: inn,
    cost: Math.max(0, net),
    held: Math.max(0, -net),
    // A pot with no debits at all (money received, nothing spent yet) has no
    // payment to take a category from; it has no cost either, so the fallback
    // is only ever a label.
    category: anchor?.Category ?? "Other / Personal Transfer",
    account: anchor?.Account ?? "",
    firstDate: dates[0] ?? "",
    lastDate: dates[dates.length - 1] ?? "",
    months: Array.from(new Set(transactions.map((t) => t.Month))).sort(),
    transactions: transactions.slice(),
  };
}

/**
 * Every pot across the whole ledger, most recently active first — the
 * lifetime view, which is the one that answers "what did the trip cost me".
 */
export function buildPots(transactions: Transaction[]): Pot[] {
  const byName = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const name = potNameOf(tx);
    if (!name) continue;
    const list = byName.get(name);
    if (list) list.push(tx);
    else byName.set(name, [tx]);
  }
  return Array.from(byName, ([name, rows]) => summarise(name, rows)).sort((a, b) =>
    b.lastDate.localeCompare(a.lastDate)
  );
}

/** Every distinct pot name in the ledger, for autocomplete. */
export function potNames(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map(potNameOf).filter(Boolean))).sort();
}

export interface PotAdjustment {
  /** Pots measured within this month only, in the order given. */
  pots: Pot[];
  /** Per-category cost to add on top of the un-potted debits. */
  costByCategory: Map<string, number>;
  /** The same cost, per account, so the account split keeps summing to spend. */
  costByAccount: Map<string, number>;
  /** Money held for others, per account. */
  heldByAccount: Map<string, number>;
  /** Total of `costByCategory` — what the month's pots cost you. */
  cost: number;
  /** Money received this month that belongs to other people. */
  held: number;
}

/**
 * What this month's pots contribute, given the month's own transactions.
 *
 * Callers add `costByCategory` to their un-potted debit totals and `held` to
 * their non-salary income. Doing it this way — rather than netting inside the
 * category — is what keeps the cash identity intact while stopping a category
 * going negative; see the header comment.
 */
export function potAdjustment(monthTransactions: Transaction[]): PotAdjustment {
  const pots = buildPots(monthTransactions);
  const costByCategory = new Map<string, number>();
  const costByAccount = new Map<string, number>();
  const heldByAccount = new Map<string, number>();
  let cost = 0;
  let held = 0;

  const add = (map: Map<string, number>, key: string, value: number) =>
    map.set(key, (map.get(key) ?? 0) + value);

  for (const pot of pots) {
    if (pot.cost > 0) {
      add(costByCategory, pot.category, pot.cost);
      add(costByAccount, pot.account, pot.cost);
      cost += pot.cost;
    }
    if (pot.held > 0) {
      add(heldByAccount, pot.account, pot.held);
      held += pot.held;
    }
  }

  return { pots, costByCategory, costByAccount, heldByAccount, cost, held };
}

/**
 * Splits a month's rows into the ones that count on their own and the ones a
 * pot speaks for. Every caller needs the same split, so it lives here rather
 * than being re-derived with a slightly different filter each time.
 */
export function splitByPot(transactions: Transaction[]): {
  loose: Transaction[];
  potted: Transaction[];
} {
  const loose: Transaction[] = [];
  const potted: Transaction[] = [];
  for (const tx of transactions) (isInPot(tx) ? potted : loose).push(tx);
  return { loose, potted };
}
