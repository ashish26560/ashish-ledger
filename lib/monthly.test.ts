import { describe, expect, it } from "vitest";
import { BIG_PAYMENT_FLOOR, buildMonthSummaries, foldCategoryTail, formatSignedINR } from "@/lib/monthly";
import type { Transaction } from "@/lib/types";

const HDFC = "HDFC ...9939";
const SBI = "SBI ...1933";

let seq = 0;
function transaction(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  const date = overrides.Date ?? "2026-08-05";
  return {
    id: `t${seq}`,
    Date: date,
    Time: "",
    Account: HDFC,
    Description: "TEST",
    FullDescription: "",
    Category: "Other / Personal Transfer",
    Subcategory: "",
  Pot: "",
    Type: "Debit",
    Amount: 100,
    Balance: "",
    Month: date.slice(0, 7),
    ...overrides,
  };
}

describe("buildMonthSummaries", () => {
  it("splits credits into salary and everything else, and nets them against spend", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Type: "Credit", Category: "Income - Salary", Amount: 82737 }),
        transaction({ Type: "Credit", Category: "Income - Group Reimbursement", Amount: 20000 }),
        transaction({ Type: "Debit", Amount: 90000 }),
      ],
      [HDFC]
    );

    expect(aug.salary).toBe(82737);
    expect(aug.otherIn).toBe(20000);
    expect(aug.spent).toBe(90000);
    expect(aug.net).toBe(12737);
  });

  it("is negative when the month spent more than came in", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Type: "Credit", Category: "Income - Salary", Amount: 50000 }),
        transaction({ Type: "Debit", Amount: 65690 }),
      ],
      [HDFC]
    );
    expect(aug.net).toBe(-15690);
  });

  it("excludes self transfers from spend, income and the payment list, and reports them separately", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Type: "Debit", Category: "Self Transfer", Amount: 50000 }),
        transaction({ Type: "Credit", Category: "Self Transfer", Amount: 50000, Account: SBI }),
        transaction({ Type: "Debit", Amount: 1200 }),
      ],
      [HDFC, SBI]
    );

    expect(aug.spent).toBe(1200);
    expect(aug.otherIn).toBe(0);
    expect(aug.txnCount).toBe(1);
    expect(aug.selfTransferTotal).toBe(50000);
    expect(aug.topPayments.map((t) => Number(t.Amount))).toEqual([1200]);
    // and the SBI side of the shuffle isn't booked as money received
    expect(aug.accounts.find((a) => a.account === SBI)?.received).toBe(0);
  });

  it("counts a debit as spend even in a non-expense category, because it still left the account", () => {
    // "Other / Personal Transfer" is everyday spend; the interesting case is a
    // debit filed under an income category, which the dashboard's expense
    // total would drop. Here it must still count — the bank balance moved.
    const [aug] = buildMonthSummaries(
      [transaction({ Type: "Debit", Category: "Income - Other", Amount: 400 })],
      [HDFC]
    );
    expect(aug.spent).toBe(400);
  });

  it("splits spend per account in the order given, keeping empty accounts in place", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Account: HDFC, Amount: 300 }),
        transaction({ Account: HDFC, Amount: 700 }),
        transaction({ Account: SBI, Type: "Credit", Category: "Income - Other", Amount: 50 }),
      ],
      [SBI, HDFC]
    );

    expect(aug.accounts.map((a) => a.account)).toEqual([SBI, HDFC]);
    expect(aug.accounts[0]).toMatchObject({ spent: 0, received: 50, count: 0 });
    expect(aug.accounts[1]).toMatchObject({ spent: 1000, received: 0, count: 2 });
  });

  it("ranks categories by total, biggest first", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Category: "Grocery", Amount: 500 }),
        transaction({ Category: "Shopping", Amount: 4000 }),
        transaction({ Category: "Grocery", Amount: 800 }),
      ],
      [HDFC]
    );
    expect(aug.categories).toEqual([
      ["Shopping", 4000],
      ["Grocery", 1300],
    ]);
  });

  it("lists only payments over the floor, biggest first", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Amount: BIG_PAYMENT_FLOOR - 1 }),
        transaction({ Amount: 9514 }),
        transaction({ Amount: BIG_PAYMENT_FLOOR }),
      ],
      [HDFC]
    );
    expect(aug.topPayments.map((t) => Number(t.Amount))).toEqual([9514, BIG_PAYMENT_FLOOR]);
  });

  it("falls back to the biggest few when a quiet month clears nothing", () => {
    const [aug] = buildMonthSummaries(
      [transaction({ Amount: 90 }), transaction({ Amount: 240 })],
      [HDFC]
    );
    expect(aug.topPayments.map((t) => Number(t.Amount))).toEqual([240, 90]);
  });

  it("returns one summary per month, oldest first", () => {
    const summaries = buildMonthSummaries(
      [
        transaction({ Date: "2026-09-02", Amount: 10 }),
        transaction({ Date: "2026-07-02", Amount: 10 }),
        transaction({ Date: "2026-08-02", Amount: 10 }),
      ],
      [HDFC]
    );
    expect(summaries.map((s) => s.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(summaries[0].label).toBe("Jul 2026");
  });

  it("returns nothing for an empty ledger rather than a zeroed month", () => {
    expect(buildMonthSummaries([], [HDFC])).toEqual([]);
  });
});

describe("buildMonthSummaries with shared pots", () => {
  it("charges you only your share of a group dinner you fronted", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Type: "Credit", Category: "Income - Salary", Amount: 80000 }),
        transaction({ Pot: "Sat dinner", Category: "Food & Dining", Type: "Debit", Amount: 9000 }),
        transaction({ Pot: "Sat dinner", Category: "Food & Dining", Type: "Credit", Amount: 8000 }),
      ],
      [HDFC]
    );

    expect(aug.spent).toBe(1000);
    expect(aug.categories).toEqual([["Food & Dining", 1000]]);
    expect(aug.potCost).toBe(1000);
    // the repayment is not income, so it must not appear as money in
    expect(aug.otherIn).toBe(0);
    expect(aug.otherInItems).toEqual([]);
  });

  it("charges you nothing for a booking made with someone else's money, and flags what you hold", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Pot: "Airbnb", Category: "Transport", Type: "Credit", Amount: 20000 }),
        transaction({ Pot: "Airbnb", Category: "Transport", Type: "Debit", Amount: 16443.33 }),
      ],
      [HDFC]
    );

    expect(aug.spent).toBe(0);
    // never a negative category
    expect(aug.categories).toEqual([]);
    expect(aug.potHeld).toBeCloseTo(3556.67, 2);
    expect(aug.otherIn).toBeCloseTo(3556.67, 2);
  });

  it("still reconciles to the bank: net equals every credit minus every debit", () => {
    const rows = [
      transaction({ Type: "Credit", Category: "Income - Salary", Amount: 80000 }),
      transaction({ Category: "Grocery", Amount: 2500 }),
      transaction({ Pot: "Sat dinner", Category: "Food & Dining", Type: "Debit", Amount: 9000 }),
      transaction({ Pot: "Sat dinner", Category: "Food & Dining", Type: "Credit", Amount: 8000 }),
      transaction({ Pot: "Airbnb", Category: "Transport", Type: "Credit", Amount: 20000 }),
      transaction({ Pot: "Airbnb", Category: "Transport", Type: "Debit", Amount: 16443.33 }),
    ];
    const [aug] = buildMonthSummaries(rows, [HDFC]);

    const cash =
      rows.filter((t) => t.Type === "Credit").reduce((s, t) => s + Number(t.Amount), 0) -
      rows.filter((t) => t.Type === "Debit").reduce((s, t) => s + Number(t.Amount), 0);

    expect(aug.net).toBeCloseTo(cash, 6);
    expect(aug.salary + aug.otherIn - aug.spent).toBeCloseTo(aug.net, 6);
  });

  it("keeps the account split adding up to the month's spend", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Account: HDFC, Category: "Grocery", Amount: 2500 }),
        transaction({ Account: SBI, Pot: "Airbnb", Category: "Transport", Type: "Credit", Amount: 20000 }),
        transaction({ Account: SBI, Pot: "Airbnb", Category: "Transport", Type: "Debit", Amount: 16443.33 }),
        transaction({ Account: SBI, Pot: "Trip", Category: "Transport", Type: "Debit", Amount: 10000 }),
        transaction({ Account: SBI, Pot: "Trip", Category: "Transport", Type: "Credit", Amount: 4000 }),
      ],
      [HDFC, SBI]
    );

    expect(aug.accounts.reduce((s, a) => s + a.spent, 0)).toBeCloseTo(aug.spent, 6);
    expect(aug.accounts.reduce((s, a) => s + a.received, 0)).toBeCloseTo(aug.salary + aug.otherIn, 6);
    expect(aug.accounts.find((a) => a.account === SBI)?.spent).toBeCloseTo(6000, 6);
  });

  it("still lists a potted payment among the biggest — it did leave the account", () => {
    const [aug] = buildMonthSummaries(
      [
        transaction({ Pot: "Airbnb", Category: "Transport", Type: "Debit", Amount: 16443.33 }),
        transaction({ Pot: "Airbnb", Category: "Transport", Type: "Credit", Amount: 20000 }),
      ],
      [HDFC]
    );
    expect(aug.topPayments.map((t) => Number(t.Amount))).toEqual([16443.33]);
    expect(aug.txnCount).toBe(1);
  });

  it("reads a pot settled the following month as full cost then, money back later", () => {
    // The bank saw ₹9,000 leave in August and ₹8,000 arrive in September, so
    // that is what each month says. buildPots gives the ₹1,000 lifetime answer.
    const [aug, sep] = buildMonthSummaries(
      [
        transaction({ Date: "2026-08-28", Pot: "Sat dinner", Category: "Food & Dining", Type: "Debit", Amount: 9000 }),
        transaction({ Date: "2026-09-03", Pot: "Sat dinner", Category: "Food & Dining", Type: "Credit", Amount: 8000 }),
      ],
      [HDFC]
    );

    expect(aug.spent).toBe(9000);
    expect(sep.spent).toBe(0);
    expect(sep.potHeld).toBe(8000);
  });
});

describe("foldCategoryTail", () => {
  const entries = (n: number): [string, number][] =>
    Array.from({ length: n }, (_, i) => [`cat${i}`, (n - i) * 100] as [string, number]);

  it("leaves a short list alone", () => {
    const { head, tail } = foldCategoryTail(entries(3));
    expect(head).toHaveLength(3);
    expect(tail).toBeNull();
  });

  it("folds everything past the cut into one total", () => {
    const { head, tail } = foldCategoryTail(entries(11), 8);
    expect(head).toHaveLength(8);
    expect(tail).toEqual({ count: 3, total: 300 + 200 + 100 });
  });
});

describe("formatSignedINR", () => {
  it("marks a drawdown with a minus and a surplus with a plus", () => {
    expect(formatSignedINR(-15690.46)).toBe("−₹15,690.46");
    expect(formatSignedINR(15690.46)).toBe("+₹15,690.46");
    expect(formatSignedINR(0)).toBe("+₹0.00");
  });
});
