// Pure row-processing core: no File/DOM APIs, so it's the part covered by
// unit tests (see lib/statementParser/parse.test.ts). extract.ts is the
// only part of this module that actually touches the browser.

import type { Bank, ISODate, ParsedStatement, StatementCandidate } from "@/lib/types";
import type { StatementRow } from "@/lib/statementParser/extract";

const HEADER_PATTERNS = {
  date: /^(txn\s*date|transaction\s*date|date)$/i,
  description: /(narration|description|particulars|transaction\s*remarks|details|remarks)/i,
  debit: /(withdrawal|debit)/i,
  credit: /(deposit|credit)/i,
  balance: /(closing\s*bal|balance)/i,
};

interface HeaderColumns {
  date: number;
  description: number;
  debit: number;
  credit: number;
  balance?: number;
}

interface HeaderMatch {
  headerIndex: number;
  cols: HeaderColumns;
}

function findHeaderRow(rows: StatementRow[]): HeaderMatch | null {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i].map((c) => String(c || "").trim());
    const idx: Partial<HeaderColumns> = {};
    row.forEach((cell, ci) => {
      if (idx.date == null && HEADER_PATTERNS.date.test(cell)) idx.date = ci;
      if (idx.description == null && HEADER_PATTERNS.description.test(cell)) idx.description = ci;
      if (idx.debit == null && HEADER_PATTERNS.debit.test(cell)) idx.debit = ci;
      if (idx.credit == null && HEADER_PATTERNS.credit.test(cell)) idx.credit = ci;
      if (HEADER_PATTERNS.balance.test(cell)) idx.balance = ci; // last match wins (prefers "closing balance")
    });
    if (idx.date != null && idx.description != null && idx.debit != null && idx.credit != null) {
      return { headerIndex: i, cols: idx as HeaderColumns };
    }
  }
  return null;
}

function parseDate(raw: unknown): ISODate | null {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo] = m;
    let y = m[3];
    if (y.length === 2) y = (Number(y) < 70 ? "20" : "19") + y;
    return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function parseAmount(raw: unknown): number {
  const s = String(raw ?? "").replace(/,/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Bank narrations truncate to a fixed width, but the delimiter and layout
// differ by bank. For UPI lines the useful part is the payee-name segment;
// for everything else we mirror the bank's own ~40-char truncation.
export function cleanDescription(rawNarration: string | null | undefined): string {
  const s = String(rawNarration ?? "")
    .trim()
    .replace(/\s+/g, " ");

  // HDFC style: "UPI-<PAYEE>-<vpa>-...", payee right after the leading "UPI-".
  const hdfcUpi = s.match(/^UPI-([^-]+)-/i);
  if (hdfcUpi) return hdfcUpi[1].trim();

  // SBI style: "... UPI/DR/<ref>/<PAYEE>/<bank>/<vpa>/...", payee is the
  // segment right after the DR/CR + reference number, wherever it appears
  // in the line (often prefixed with "WDL TFR"/"DEP TFR").
  const sbiUpi = s.match(/UPI\/(?:DR|CR)\/\d+\/([^/]+)\//i);
  if (sbiUpi) return sbiUpi[1].trim();

  return s.length > 40 ? s.slice(0, 40).trim() : s;
}

// Only the letterhead area above the transaction table (rows before the
// detected header row) is scanned for bank/account identity — transaction
// narrations further down routinely mention *other* banks (a UPI
// counterparty's bank code, e.g. ".../FLIPKART/HDFC/...") and would
// otherwise cause false matches.
function detectBank(letterheadRows: StatementRow[]): Bank {
  const head = letterheadRows
    .map((r) => r.join(" "))
    .join(" ")
    .toUpperCase();
  if (head.includes("HDFC BANK")) return "HDFC";
  if (head.includes("STATE BANK OF INDIA") || head.includes(" SBI ")) return "SBI";
  return "Bank";
}

function detectAccountLast4(letterheadRows: StatementRow[]): string | null {
  const head = letterheadRows.map((r) => r.join(" ")).join(" ");
  const m = head.match(/A(?:\/c|ccount)\s*(?:No\.?|Number)?\s*[:-]?\s*(\d{6,20})/i);
  if (m) return m[1].slice(-4);
  return null;
}

// Matches a detected statement account to an existing ledger account label
// (so re-importing the same account keeps using "HDFC ...9939" etc.) or
// builds a fresh label for a bank/account we haven't seen before.
export function resolveAccountLabel(bank: Bank, last4: string | null, existingAccounts: string[]): string {
  if (last4) {
    const existing = existingAccounts.find((a) => a.endsWith(last4));
    if (existing) return existing;
  }
  return last4 ? `${bank} ...${last4}` : bank;
}

export function extractTransactionsFromRows(rows: StatementRow[], existingAccounts: string[] = []): ParsedStatement {
  if (!rows.length) {
    throw new Error("Couldn't read any rows from this file — is it a bank statement export?");
  }

  const header = findHeaderRow(rows);
  if (!header) {
    throw new Error(
      "Couldn't find the transaction table in this file. Expected columns like Date, Narration, Withdrawal/Deposit Amt, Balance."
    );
  }

  const letterheadRows = rows.slice(0, header.headerIndex);
  const bank = detectBank(letterheadRows);
  const last4 = detectAccountLast4(letterheadRows);
  const account = resolveAccountLabel(bank, last4, existingAccounts);

  const { cols } = header;
  const candidates: StatementCandidate[] = [];
  let lastBalance: number | null = null;
  let lastDate: ISODate | null = null;

  for (let i = header.headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const date = parseDate(row[cols.date]);
    if (!date) continue; // footer / summary / blank separator rows

    const rawNarration = String(row[cols.description] || "").trim();
    if (!rawNarration) continue;

    const debit = parseAmount(row[cols.debit]);
    const credit = parseAmount(row[cols.credit]);
    if (!debit && !credit) continue;

    const balance = cols.balance != null ? parseAmount(row[cols.balance]) : null;
    if (balance != null) lastBalance = balance;
    lastDate = date;

    candidates.push({
      Date: date,
      Account: account,
      Description: cleanDescription(rawNarration),
      RawNarration: rawNarration,
      Type: debit ? "Debit" : "Credit",
      Amount: debit || credit,
      Balance: balance,
      Subcategory: "",
    });
  }

  return {
    bank,
    account,
    isNewAccount: !existingAccounts.includes(account),
    closingBalance: lastBalance,
    closingDate: lastDate,
    transactions: candidates,
  };
}
