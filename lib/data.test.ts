import { describe, expect, it } from "vitest";
import { compareDateTime, computeMonthlyNet, formatDateTime, formatINR, uniqueCategories } from "@/lib/data";
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
    expect(formatDateTime({ Date: "2026-03-01", Time: "" })).toBe("2026-03-01");
    expect(formatDateTime({ Date: "2026-03-01", Time: "09:30" })).toBe("2026-03-01 09:30");
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
