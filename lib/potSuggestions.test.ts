import { describe, expect, it } from "vitest";
import { MIN_PAIR_AMOUNT, suggestPots, suggestedName, type PairCandidate } from "@/lib/potSuggestions";

const row = (o: Partial<PairCandidate> = {}): PairCandidate => ({
  Date: "2026-08-26",
  Type: "Debit",
  Amount: 5000,
  Description: "SOMETHING",
  ...o,
});

describe("suggestPots", () => {
  it("finds the same-day money-in-then-spend pair", () => {
    // Shah Krish sends ₹20,000; the Airbnb booking goes out the same day.
    const rows = [
      row({ Type: "Credit", Amount: 20000, Description: "SHAH KRI" }),
      row({ Type: "Debit", Amount: 16443.33, Description: "Airbnb P" }),
    ];
    const [pair] = suggestPots(rows);

    expect(pair.debitIndex).toBe(1);
    expect(pair.creditIndex).toBe(0);
    expect(pair.daysApart).toBe(0);
    expect(pair.name).toBe("Airbnb P");
    // more came back than went out, so nothing was yours
    expect(pair.yourCost).toBe(0);
  });

  it("finds the pay-then-partly-refunded pair a week apart", () => {
    const rows = [
      row({ Date: "2026-08-04", Type: "Debit", Amount: 10000, Description: "KRISHNA KUMAR SONI" }),
      row({ Date: "2026-08-11", Type: "Credit", Amount: 4000, Description: "KRISHNA KUMAR SONI" }),
    ];
    const [pair] = suggestPots(rows);

    expect(pair.daysApart).toBe(7);
    expect(pair.yourCost).toBe(6000);
    expect(pair.name).toBe("KRISHNA KUMAR SONI");
  });

  it("ignores pairs too far apart in time", () => {
    expect(
      suggestPots([
        row({ Date: "2026-08-01", Type: "Debit", Amount: 9000 }),
        row({ Date: "2026-08-20", Type: "Credit", Amount: 8000 }),
      ])
    ).toEqual([]);
  });

  it("ignores pairs too far apart in size", () => {
    expect(
      suggestPots([
        row({ Type: "Debit", Amount: 20000 }),
        row({ Type: "Credit", Amount: 1200 }),
      ])
    ).toEqual([]);
  });

  it("ignores everyday small amounts entirely", () => {
    expect(
      suggestPots([
        row({ Type: "Debit", Amount: MIN_PAIR_AMOUNT - 1 }),
        row({ Type: "Credit", Amount: MIN_PAIR_AMOUNT - 1 }),
      ])
    ).toEqual([]);
  });

  it("uses each row at most once, taking the closest match first", () => {
    const rows = [
      row({ Date: "2026-08-10", Type: "Debit", Amount: 9000, Description: "DINNER" }),
      row({ Date: "2026-08-10", Type: "Credit", Amount: 8500, Description: "SAME DAY" }),
      row({ Date: "2026-08-14", Type: "Credit", Amount: 8600, Description: "LATER" }),
    ];
    const suggestions = suggestPots(rows);

    expect(suggestions).toHaveLength(1);
    expect(rows[suggestions[0].creditIndex].Description).toBe("SAME DAY");
  });

  it("returns suggestions oldest payment first", () => {
    const rows = [
      row({ Date: "2026-08-20", Type: "Debit", Amount: 9000, Description: "LATER" }),
      row({ Date: "2026-08-20", Type: "Credit", Amount: 8000 }),
      row({ Date: "2026-08-02", Type: "Debit", Amount: 7000, Description: "EARLIER" }),
      row({ Date: "2026-08-02", Type: "Credit", Amount: 6000 }),
    ];
    expect(suggestPots(rows).map((s) => rows[s.debitIndex].Description)).toEqual(["EARLIER", "LATER"]);
  });

  it("suggests nothing for an ordinary statement", () => {
    expect(
      suggestPots([
        row({ Type: "Debit", Amount: 9514, Description: "EMI" }),
        row({ Type: "Debit", Amount: 2500, Description: "GROCERY" }),
        row({ Date: "2026-08-10", Type: "Credit", Amount: 82737, Description: "SALARY AUG-2026" }),
      ])
    ).toEqual([]);
  });
});

describe("suggestedName", () => {
  it("drops reference numbers and tidies separators", () => {
    expect(suggestedName("UPI-AIRBNB PAYMENTS-623845083322")).toBe("UPI-AIRBNB PAYMENTS-");
    expect(suggestedName("WDL TFR UPI/DR/619054860233/ASPIRE C")).toBe("WDL TFR UPI DR ASPIRE C");
  });

  it("truncates a very long narration", () => {
    const name = suggestedName("A".repeat(120));
    expect(name.length).toBeLessThanOrEqual(41);
    expect(name.endsWith("…")).toBe(true);
  });
});
