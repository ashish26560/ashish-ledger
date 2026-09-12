import { describe, expect, it } from "vitest";
import {
  compareDateTime,
  computeCategoryTotals,
  computeMonthlyNet,
  formatDate,
  formatDateTime,
  formatINR,
  uniqueCategories,
} from "@/lib/data";
import type { Transaction } from "@/lib/types";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    Date: "2026-03-01",
    Time: "",
    Account: "HDFC ...9939",
    Description: "TEST",
    FullDescription: "",
    Category: "Other / Personal Transfer",
    Subcategory: "",
    Pot: "",
    Type: "Debit",
    Amount: 100,
    Balance: 1000,
    Month: "2026-03",
    ...overrides,
  };
}

describe("formatINR", () => {
  it("formats a positive amount with the rupee symbol and two decimals", () => {
    expect(formatINR(1234.5)).toBe("₹1,234.50");
  });

  it("formats zero/null/undefined as ₹0.00", () => {
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(null)).toBe("₹0.00");
    expect(formatINR(undefined)).toBe("₹0.00");
    expect(formatINR("")).toBe("₹0.00");
  });

  it("adds a sign when signed:true is requested", () => {
    expect(formatINR(100, { signed: true })).toBe("+₹100.00");
    expect(formatINR(-100, { signed: true })).toBe("-₹100.00");
  });
});

describe("compareDateTime", () => {
  it("orders by date first", () => {
    const a = { Date: "2026-03-01", Time: "" };
    const b = { Date: "2026-03-02", Time: "" };
    expect(compareDateTime(a, b)).toBeLessThan(0);
  });

  it("treats a missing Time as earlier than any timed entry on the same day", () => {
    const untimed = { Date: "2026-03-01", Time: "" };
    const timed = { Date: "2026-03-01", Time: "09:00" };
    expect(compareDateTime(untimed, timed)).toBeLessThan(0);
  });

  it("orders by time within the same day", () => {
    const early = { Date: "2026-03-01", Time: "08:00" };
    const late = { Date: "2026-03-01", Time: "20:00" };
    expect(compareDateTime(early, late)).toBeLessThan(0);
  });
});

describe("formatDateTime", () => {
  it("appends the time only when present", () => {
    expect(formatDateTime({ Date: "2026-03-01", Time: "" })).toBe("01-Mar-2026");
    expect(formatDateTime({ Date: "2026-03-01", Time: "09:30" })).toBe("01-Mar-2026 09:30");
  });
});

describe("computeMonthlyNet", () => {
  it("nets debits minus credits within expense categories", () => {
    const rows = [
      transaction({ Type: "Debit", Amount: 500, Month: "2026-03" }),
      transaction({ Type: "Credit", Amount: 100, Month: "2026-03" }),
    ];
    expect(computeMonthlyNet(rows)["2026-03"]).toBe(400);
  });

  it("excludes categories like salary and self-transfer from expense totals", () => {
    const rows = [
      transaction({ Type: "Credit", Amount: 50000, Category: "Income - Salary", Month: "2026-03" }),
      transaction({ Type: "Debit", Amount: 200, Category: "Self Transfer", Month: "2026-03" }),
      transaction({ Type: "Debit", Amount: 300, Category: "Grocery", Month: "2026-03" }),
    ];
    expect(computeMonthlyNet(rows)["2026-03"]).toBe(300);
  });
});

describe("uniqueCategories", () => {
  it("sorts categories by the canonical CATEGORY_ORDER, not alphabetically", () => {
    const rows = [
      transaction({ Category: "Income - Salary" }),
      transaction({ Category: "Grocery" }),
      transaction({ Category: "Fuel" }),
    ];
    // Grocery comes before Fuel in CATEGORY_ORDER, both come well before
    // Income - Salary — alphabetical order would put Fuel before Grocery.
    expect(uniqueCategories(rows)).toEqual(["Grocery", "Fuel", "Income - Salary"]);
  });
});

describe("formatDate", () => {
  it("renders a stored ISO date as DD-MMM-YYYY", () => {
    expect(formatDate("2026-09-09")).toBe("09-Sep-2026");
    expect(formatDate("2026-01-01")).toBe("01-Jan-2026");
    expect(formatDate("2026-12-31")).toBe("31-Dec-2026");
  });

  it("keeps the day zero-padded so columns stay aligned", () => {
    expect(formatDate("2026-03-05")).toBe("05-Mar-2026");
  });

  it("passes through anything that isn't an ISO date rather than mangling it", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("09-Sep-2026")).toBe("09-Sep-2026");
    expect(formatDate("2026-13-01")).toBe("2026-13-01");
  });

  it("formats the date inside formatDateTime, keeping any time alongside", () => {
    expect(formatDateTime({ Date: "2026-09-09", Time: "14:32" })).toBe("09-Sep-2026 14:32");
    expect(formatDateTime({ Date: "2026-09-09", Time: "" })).toBe("09-Sep-2026");
  });
});

describe("pot-aware dashboard totals", () => {
  // Same three rows the Monthly page is tested on, so a divergence between
  // the two pages shows up as a failure rather than as two different answers
  // on screen.
  const dinner = [
    transaction({ id: "d1", Pot: "Sat dinner", Category: "Food & Dining", Type: "Debit", Amount: 9000 }),
    transaction({ id: "d2", Pot: "Sat dinner", Category: "Food & Dining", Type: "Credit", Amount: 8000 }),
    transaction({ id: "g1", Category: "Grocery", Type: "Debit", Amount: 500 }),
  ];

  it("counts a pot at what it cost you, not at face value", () => {
    expect(computeMonthlyNet(dinner)["2026-03"]).toBe(1500);
    expect(computeCategoryTotals(dinner, "2026-03")).toEqual({ "Food & Dining": 1000, Grocery: 500 });
  });

  it("never turns a pot you came out ahead on into a negative category", () => {
    const airbnb = [
      transaction({ id: "a1", Pot: "Airbnb", Category: "Transport", Type: "Credit", Amount: 20000 }),
      transaction({ id: "a2", Pot: "Airbnb", Category: "Transport", Type: "Debit", Amount: 16000 }),
    ];
    expect(computeCategoryTotals(airbnb, "2026-03")).toEqual({});
    expect(computeMonthlyNet(airbnb)["2026-03"] ?? 0).toBe(0);
  });

  it("leaves a ledger with no pots exactly as it was", () => {
    const plain = [
      transaction({ id: "p1", Category: "Grocery", Type: "Debit", Amount: 500 }),
      transaction({ id: "p2", Category: "Shopping", Type: "Debit", Amount: 1200 }),
    ];
    expect(computeMonthlyNet(plain)["2026-03"]).toBe(1700);
    expect(computeCategoryTotals(plain)).toEqual({ Grocery: 500, Shopping: 1200 });
  });
});
