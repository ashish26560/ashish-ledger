import { describe, expect, it } from "vitest";
import { buildLearnedCategoryMap, categorizeAll, categorizeTransaction } from "@/lib/categorize";
import type { StatementCandidate, Transaction } from "@/lib/types";

function candidate(overrides: Partial<StatementCandidate> = {}): StatementCandidate {
  return {
    Date: "2026-04-01",
    Account: "HDFC ...9939",
    Description: "SOME PAYEE",
    RawNarration: "SOME PAYEE",
    Type: "Debit",
    Amount: 100,
    Balance: null,
    Subcategory: "",
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    Date: "2026-03-01",
    Time: "",
    Account: "SBI ...1933",
    Description: "Hadiya M",
    FullDescription: "",
    Category: "Income - Group Reimbursement",
    Subcategory: "",
    Type: "Credit",
    Amount: 451.44,
    Balance: 190112.68,
    Month: "2026-03",
    ...overrides,
  };
}

describe("categorizeTransaction — structural rules", () => {
  it("categorizes a salary credit", () => {
    const result = categorizeTransaction(candidate({ RawNarration: "SALARY MAR26 ACME CORP", Type: "Credit" }), new Map());
    expect(result).toEqual({ category: "Income - Salary", confidence: "rule" });
  });

  it("categorizes an EMI cheque debit", () => {
    const result = categorizeTransaction(candidate({ RawNarration: "EMI PRESENTED CHQ 000123" }), new Map());
    expect(result.category).toBe("Loan EMI");
  });

  it("categorizes a credit card autopay debit", () => {
    const result = categorizeTransaction(candidate({ RawNarration: "CC 4521 AUTOPAY DEBIT" }), new Map());
    expect(result.category).toBe("Credit Card Payment");
  });

  it("categorizes a cash withdrawal", () => {
    const result = categorizeTransaction(candidate({ RawNarration: "NWD-ATM CASH WDL" }), new Map());
    expect(result.category).toBe("Cash Withdrawal");
  });
});

describe("categorizeTransaction — merchant keyword rules", () => {
  it("recognizes a food-delivery merchant", () => {
    const result = categorizeTransaction(candidate({ Description: "ZOMATO", RawNarration: "ZOMATO ORDER" }), new Map());
    expect(result).toEqual({ category: "Food & Dining", confidence: "rule" });
  });

  it("recognizes a grocery merchant", () => {
    const result = categorizeTransaction(candidate({ Description: "BLINKIT", RawNarration: "BLINKIT" }), new Map());
    expect(result.category).toBe("Grocery");
  });
});

describe("categorizeTransaction — fallback", () => {
  it("falls back to Income - Other for an unrecognized credit", () => {
    const result = categorizeTransaction(candidate({ Type: "Credit" }), new Map());
    expect(result).toEqual({ category: "Income - Other", confidence: "fallback" });
  });

  it("falls back to Other / Personal Transfer for an unrecognized debit", () => {
    const result = categorizeTransaction(candidate({ Type: "Debit" }), new Map());
    expect(result).toEqual({ category: "Other / Personal Transfer", confidence: "fallback" });
  });
});

describe("buildLearnedCategoryMap — direction-aware (regression)", () => {
  // Real-world bug: "Hadiya M" appears once in the ledger as a Credit
  // (a reimbursement, categorized "Income - Group Reimbursement"). A brand
  // new *Debit* to "Hadiya M" from a freshly imported statement must not
  // inherit that category just because the payee name matches — the two
  // directions are different kinds of relationship with that person.
  const existing = [transaction()]; // "Hadiya M" Credit, Income - Group Reimbursement

  it("learns the category for the same payee + same direction", () => {
    const learned = buildLearnedCategoryMap(existing);
    const result = categorizeTransaction(candidate({ Description: "Hadiya M", RawNarration: "Hadiya M", Type: "Credit" }), learned);
    expect(result).toEqual({ category: "Income - Group Reimbursement", confidence: "learned" });
  });

  it("does NOT apply the learned category to the opposite direction", () => {
    const learned = buildLearnedCategoryMap(existing);
    const result = categorizeTransaction(candidate({ Description: "Hadiya M", RawNarration: "Hadiya M", Type: "Debit" }), learned);
    expect(result.confidence).not.toBe("learned");
    expect(result.category).toBe("Other / Personal Transfer");
  });

  it("picks the most common category when a payee+direction was categorized inconsistently", () => {
    const existingMixed = [
      transaction({ id: "a", Description: "Freelance Client", Type: "Credit", Category: "Income - Other" }),
      transaction({ id: "b", Description: "Freelance Client", Type: "Credit", Category: "Income - Other" }),
      transaction({ id: "c", Description: "Freelance Client", Type: "Credit", Category: "Income - Group Reimbursement" }),
    ];
    const learned = buildLearnedCategoryMap(existingMixed);
    const result = categorizeTransaction(
      candidate({ Description: "Freelance Client", RawNarration: "Freelance Client", Type: "Credit" }),
      learned
    );
    expect(result).toEqual({ category: "Income - Other", confidence: "learned" });
  });
});

describe("categorizeAll", () => {
  it("categorizes a batch of candidates against existing history in one call", () => {
    const existing = [transaction()];
    const candidates = [
      candidate({ Description: "Hadiya M", RawNarration: "Hadiya M", Type: "Credit" }),
      candidate({ RawNarration: "SALARY APR26", Type: "Credit" }),
    ];
    const results = categorizeAll(candidates, existing);
    expect(results[0].category).toBe("Income - Group Reimbursement");
    expect(results[1].category).toBe("Income - Salary");
  });
});
