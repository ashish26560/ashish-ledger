import { describe, expect, it } from "vitest";
import { cleanDescription, extractTransactionsFromRows, resolveAccountLabel } from "@/lib/statementParser/parse";
import type { StatementRow } from "@/lib/statementParser/extract";

describe("cleanDescription", () => {
  it("extracts the payee from an HDFC-style UPI narration", () => {
    expect(cleanDescription("UPI-ZOMATO-zomato@ybl-CR1234567890-Order Payment")).toBe("ZOMATO");
  });

  it("extracts the payee from an SBI-style UPI narration", () => {
    expect(cleanDescription("TFR TO 500001/UPI/DR/301234567890/BLINKIT INDIA/HDFC0001234/blinkit@hdfcbank")).toBe(
      "BLINKIT INDIA"
    );
  });

  it("truncates a plain (non-UPI) narration to 40 characters", () => {
    const long = "TRANSFER FROM SOME VERY LONG ACCOUNT HOLDER NAME HERE";
    expect(cleanDescription(long)).toBe(long.slice(0, 40).trim());
  });

  it("leaves a short plain narration untouched", () => {
    expect(cleanDescription("ATM WDL")).toBe("ATM WDL");
  });
});

describe("resolveAccountLabel", () => {
  it("reuses an existing account label matched by the last 4 digits", () => {
    expect(resolveAccountLabel("HDFC", "9939", ["HDFC ...9939", "SBI ...1933"])).toBe("HDFC ...9939");
  });

  it("builds a fresh label when no existing account matches", () => {
    expect(resolveAccountLabel("SBI", "3000", ["HDFC ...9939"])).toBe("SBI ...3000");
  });

  it("falls back to the bare bank name when no account number was found", () => {
    expect(resolveAccountLabel("Bank", null, [])).toBe("Bank");
  });
});

const HDFC_ROWS: StatementRow[] = [
  ["HDFC BANK LIMITED"],
  ["Statement of account"],
  ["Account No :", "50100533919939"],
  ["Date", "Narration", "Chq/Ref No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
  ["01/04/26", "UPI-ZOMATO-zomato@ybl-CR1234567890-Order Payment", "", "01/04/26", "", "250.00", "54250.00"],
  ["03/04/26", "UPI-JOHN DOE-johndoe@okhdfcbank-DR5678901234-Rent", "", "03/04/26", "5000.00", "", "49250.00"],
];

// The exact SBI export column names ("Txn Date" / "Description" /
// "Debit"/"Credit") and slash-delimited UPI narration style, including a
// transaction that mentions a *counterparty's* bank code ("HDFC0001234")
// further down the file — a regression fixture for the bug where bank
// detection used to scan transaction rows too and misidentified this as an
// HDFC statement.
const SBI_ROWS: StatementRow[] = [
  ["STATE BANK OF INDIA"],
  ["Account Statement"],
  ["Account Number", ":", "00000034561933000"],
  ["Name", ":", "CHAUHAN ASHISH VIRJIBHAI"],
  ["Txn Date", "Value Date", "Description", "Ref No./Cheque No.", "Debit", "Credit", "Balance"],
  ["01/04/26", "01/04/26", "TRANSFER FROM 50100533919939-CHAUHAN", "123456", "0", "50000", "100847.89"],
  [
    "06/04/26",
    "06/04/26",
    "TFR TO 50100533919939/UPI/DR/301234567890/BLINKIT INDIA/HDFC0001234/blinkit@hdfcbank",
    "654321",
    "850.50",
    "0",
    "99997.39",
  ],
  ["10/04/26", "10/04/26", "ATM WDL", "998877", "2000", "0", "97997.39"],
];

describe("extractTransactionsFromRows", () => {
  it("throws a clear error on an empty file", () => {
    expect(() => extractTransactionsFromRows([], [])).toThrow(/couldn't read any rows/i);
  });

  it("throws a clear error when no transaction table header is found", () => {
    expect(() => extractTransactionsFromRows([["nothing useful here"]], [])).toThrow(
      /couldn't find the transaction table/i
    );
  });

  it("parses an HDFC statement: bank, account, dates, amounts, and UPI payee cleaning", () => {
    const result = extractTransactionsFromRows(HDFC_ROWS, []);
    expect(result.bank).toBe("HDFC");
    expect(result.account).toBe("HDFC ...9939");
    expect(result.isNewAccount).toBe(true);
    expect(result.transactions).toHaveLength(2);

    expect(result.transactions[0]).toMatchObject({
      Date: "2026-04-01",
      Type: "Credit",
      Amount: 250,
      Description: "ZOMATO",
    });
    expect(result.transactions[1]).toMatchObject({
      Date: "2026-04-03",
      Type: "Debit",
      Amount: 5000,
      Description: "JOHN DOE",
    });
    expect(result.closingBalance).toBe(49250);
  });

  it("reuses an existing account label when the last 4 digits match", () => {
    const result = extractTransactionsFromRows(HDFC_ROWS, ["HDFC ...9939"]);
    expect(result.account).toBe("HDFC ...9939");
    expect(result.isNewAccount).toBe(false);
  });

  it("parses an SBI statement with slash-delimited UPI narrations", () => {
    const result = extractTransactionsFromRows(SBI_ROWS, []);
    expect(result.bank).toBe("SBI");
    expect(result.account).toBe("SBI ...3000");
    expect(result.transactions).toHaveLength(3);

    expect(result.transactions[1]).toMatchObject({
      Date: "2026-04-06",
      Type: "Debit",
      Amount: 850.5,
      Description: "BLINKIT INDIA",
    });
    expect(result.closingBalance).toBe(97997.39);
    expect(result.closingDate).toBe("2026-04-10");
  });

  it("does not misidentify the bank from a counterparty's bank code inside a transaction row", () => {
    // Row 6 above mentions "HDFC0001234" as BLINKIT's bank code, but this is
    // an SBI statement — detection must only look at the letterhead rows.
    const result = extractTransactionsFromRows(SBI_ROWS, []);
    expect(result.bank).toBe("SBI");
  });

  it("requires the full phrase 'HDFC BANK', not just 'HDFC', to detect HDFC", () => {
    const rowsWithBareHdfcMention: StatementRow[] = [
      ["Some other institution, formerly known as HDFC affiliate"],
      ["Date", "Narration", "Withdrawal Amt.", "Deposit Amt.", "Balance"],
      ["01/04/26", "ATM WDL", "500", "", "1000"],
    ];
    const result = extractTransactionsFromRows(rowsWithBareHdfcMention, []);
    expect(result.bank).toBe("Bank");
  });
});
