// Shared domain types used on both the client and the server (API routes).
// Keeping these in one place is what makes "the client and the server agree
// on the shape of a transaction" a compile-time guarantee instead of a
// documentation comment.

import type { Category } from "@/lib/categories";

export type TransactionType = "Debit" | "Credit";

// ISO date string, "YYYY-MM-DD".
export type ISODate = string;

// "HH:MM" (24-hour), or "" when unknown (every bank-statement import; older
// manually-logged entries predating the Time field).
export type TimeString = string;

/**
 * A single ledger entry, in the shape the client and the database agree on.
 * `Balance` is `""` rather than `null`/`undefined` when unknown, matching
 * the empty-string convention the UI's number inputs already used before
 * this migration — kept as-is rather than churned to `null` everywhere.
 */
export interface Transaction {
  id: string;
  Date: ISODate;
  Time: TimeString;
  Account: string;
  Description: string;
  /**
   * The untruncated bank narration a statement import produced `Description`
   * from (or "" for manual entries and rows imported before this field
   * existed). `Description` stays short for table/list display; this is
   * what a hover tooltip shows in full.
   */
  FullDescription: string;
  Category: Category;
  Subcategory: string;
  Type: TransactionType;
  Amount: number;
  Balance: number | "";
  /** Derived, "YYYY-MM", used for month filters/grouping. */
  Month: string;
}

/** The subset of transaction fields the UI is ever allowed to edit in place. */
export type EditableTransactionFields = Partial<
  Pick<
    Transaction,
    | "Date"
    | "Time"
    | "Account"
    | "Description"
    | "FullDescription"
    | "Category"
    | "Subcategory"
    | "Type"
    | "Amount"
    | "Balance"
  >
>;

/** Fields needed to create a new transaction; `id` and `Month` are server-assigned. */
export type NewTransaction = Omit<Transaction, "id" | "Month">;

export interface AccountBalance {
  balance: number;
  asOf: ISODate;
}

export type BalancesByAccount = Record<string, AccountBalance>;

// --- Statement import -------------------------------------------------

/** A bank name as detected from a statement's letterhead. */
export type Bank = "HDFC" | "SBI" | "Bank";

/**
 * A transaction candidate extracted from a statement file, before
 * categorization. `RawNarration` is kept alongside the cleaned
 * `Description` because a couple of the structural categorization rules
 * need to match against the untruncated bank narration.
 */
export interface StatementCandidate {
  Date: ISODate;
  Account: string;
  Description: string;
  RawNarration: string;
  Type: TransactionType;
  Amount: number;
  Balance: number | null;
  Subcategory: string;
}

export type CategoryConfidence = "rule" | "learned" | "fallback" | "manual";

export interface CategorizedCandidate extends StatementCandidate {
  category: Category;
  confidence: CategoryConfidence;
}

/** A categorized candidate plus the import-preview UI's own row state. */
export interface ImportRow extends CategorizedCandidate {
  include: boolean;
  duplicate: boolean;
}

export interface ParsedStatement {
  bank: Bank;
  account: string;
  isNewAccount: boolean;
  closingBalance: number | null;
  closingDate: ISODate | null;
  transactions: StatementCandidate[];
}
