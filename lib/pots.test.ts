import { describe, expect, it } from "vitest";
import { buildPots, potAdjustment, potNames, splitByPot } from "@/lib/pots";
import type { Transaction } from "@/lib/types";

let seq = 0;
function transaction(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  const date = overrides.Date ?? "2026-08-05";
  return {
    id: `t${seq}`,
    Date: date,
    Time: "",
    Account: "HDFC ...9939",
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

describe("buildPots — the two real shapes", () => {
  it("front the money, get part of it back: cost is what you were left holding", () => {
    // The group dinner: ₹9,000 out, ₹8,000 back from eight people.
    const [pot] = buildPots([
      transaction({ Pot: "Sat dinner", Category: "Food & Dining", Type: "Debit", Amount: 9000 }),
      transaction({ Pot: "Sat dinner", Category: "Food & Dining", Type: "Credit", Amount: 8000 }),
    ]);

    expect(pot.out).toBe(9000);
    expect(pot.in).toBe(8000);
    expect(pot.cost).toBe(1000);
    expect(pot.held).toBe(0);
    expect(pot.category).toBe("Food & Dining");
  });

  it("receive the money, then spend it: cost is nothing and the remainder isn't yours", () => {
    // Shah Krish sends ₹20,000 on 26 Aug; the Airbnb booking goes out the same day.
    const [pot] = buildPots([
      transaction({ Pot: "Airbnb", Category: "Transport", Type: "Credit", Amount: 20000 }),
      transaction({ Pot: "Airbnb", Category: "Transport", Type: "Debit", Amount: 16443.33 }),
    ]);

    expect(pot.cost).toBe(0);
    expect(pot.held).toBeCloseTo(3556.67, 2);
  });

  it("books the cost against the pot's largest payment, not its first", () => {
    const [pot] = buildPots([
      transaction({ Pot: "Goa", Category: "Food & Dining", Type: "Debit", Amount: 500, Date: "2026-08-01" }),
      transaction({ Pot: "Goa", Category: "Transport", Type: "Debit", Amount: 12000, Date: "2026-08-04" }),
    ]);
    expect(pot.category).toBe("Transport");
    expect(pot.cost).toBe(12500);
  });

  it("keeps pots apart and ignores untagged rows", () => {
    const pots = buildPots([
      transaction({ Pot: "Goa", Amount: 500 }),
      transaction({ Pot: "Sat dinner", Amount: 900 }),
      transaction({ Amount: 4000 }),
    ]);
    expect(pots.map((p) => p.name).sort()).toEqual(["Goa", "Sat dinner"]);
    expect(pots.reduce((s, p) => s + p.out, 0)).toBe(1400);
  });

  it("treats a padded pot name as the same pot", () => {
    const pots = buildPots([
      transaction({ Pot: "Goa trip", Amount: 500 }),
      transaction({ Pot: "  Goa trip  ", Amount: 700 }),
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].out).toBe(1200);
  });

  it("survives a pot with money in and nothing spent yet", () => {
    const [pot] = buildPots([transaction({ Pot: "Goa", Type: "Credit", Amount: 5000 })]);
    expect(pot.cost).toBe(0);
    expect(pot.held).toBe(5000);
    expect(pot.category).toBe("Other / Personal Transfer");
  });

  it("reports the span and months a pot covers", () => {
    const [pot] = buildPots([
      transaction({ Pot: "Goa", Date: "2026-08-28", Amount: 9000 }),
      transaction({ Pot: "Goa", Date: "2026-09-03", Type: "Credit", Amount: 4000 }),
    ]);
    expect(pot.firstDate).toBe("2026-08-28");
    expect(pot.lastDate).toBe("2026-09-03");
    expect(pot.months).toEqual(["2026-08", "2026-09"]);
  });
});

describe("potAdjustment", () => {
  it("adds only the real cost to the category, never a negative", () => {
    const adj = potAdjustment([
      transaction({ Pot: "Airbnb", Category: "Transport", Type: "Credit", Amount: 20000 }),
      transaction({ Pot: "Airbnb", Category: "Transport", Type: "Debit", Amount: 16443.33 }),
    ]);
    expect(adj.cost).toBe(0);
    expect(adj.costByCategory.get("Transport")).toBeUndefined();
    expect(adj.held).toBeCloseTo(3556.67, 2);
  });

  it("sums two pots that land in the same category", () => {
    const adj = potAdjustment([
      transaction({ Pot: "Dinner A", Category: "Food & Dining", Type: "Debit", Amount: 9000 }),
      transaction({ Pot: "Dinner A", Category: "Food & Dining", Type: "Credit", Amount: 8000 }),
      transaction({ Pot: "Dinner B", Category: "Food & Dining", Type: "Debit", Amount: 3000 }),
      transaction({ Pot: "Dinner B", Category: "Food & Dining", Type: "Credit", Amount: 500 }),
    ]);
    expect(adj.costByCategory.get("Food & Dining")).toBe(3500);
    expect(adj.cost).toBe(3500);
  });

  it("preserves the cash identity: loose debits + pot cost − held = every debit − every credit", () => {
    // The property that makes it safe to swap pot figures into the monthly
    // page: whatever the pots do, the month still reconciles to the bank.
    const rows = [
      transaction({ Amount: 2500 }),
      transaction({ Type: "Credit", Category: "Income - Other", Amount: 300 }),
      transaction({ Pot: "Dinner", Category: "Food & Dining", Type: "Debit", Amount: 9000 }),
      transaction({ Pot: "Dinner", Category: "Food & Dining", Type: "Credit", Amount: 8000 }),
      transaction({ Pot: "Airbnb", Category: "Transport", Type: "Credit", Amount: 20000 }),
      transaction({ Pot: "Airbnb", Category: "Transport", Type: "Debit", Amount: 16443.33 }),
    ];
    const { loose } = splitByPot(rows);
    const adj = potAdjustment(rows);

    const looseDebits = loose.filter((t) => t.Type === "Debit").reduce((s, t) => s + Number(t.Amount), 0);
    const looseCredits = loose.filter((t) => t.Type === "Credit").reduce((s, t) => s + Number(t.Amount), 0);

    const shownSpend = looseDebits + adj.cost;
    const shownIn = looseCredits + adj.held;

    const rawDebits = rows.filter((t) => t.Type === "Debit").reduce((s, t) => s + Number(t.Amount), 0);
    const rawCredits = rows.filter((t) => t.Type === "Credit").reduce((s, t) => s + Number(t.Amount), 0);

    expect(shownIn - shownSpend).toBeCloseTo(rawCredits - rawDebits, 6);
  });

  it("is a no-op on a ledger with no pots", () => {
    const adj = potAdjustment([transaction({ Amount: 500 }), transaction({ Amount: 900 })]);
    expect(adj.pots).toEqual([]);
    expect(adj.cost).toBe(0);
    expect(adj.held).toBe(0);
  });
});

describe("splitByPot", () => {
  it("separates tagged rows from the rest", () => {
    const { loose, potted } = splitByPot([
      transaction({ Amount: 1 }),
      transaction({ Pot: "Goa", Amount: 2 }),
      transaction({ Pot: "   ", Amount: 3 }),
    ]);
    expect(loose.map((t) => t.Amount)).toEqual([1, 3]);
    expect(potted.map((t) => t.Amount)).toEqual([2]);
  });
});

describe("potNames", () => {
  it("lists each pot once, alphabetically", () => {
    expect(
      potNames([
        transaction({ Pot: "Goa" }),
        transaction({ Pot: "Amreli" }),
        transaction({ Pot: "Goa" }),
        transaction({}),
      ])
    ).toEqual(["Amreli", "Goa"]);
  });
});
