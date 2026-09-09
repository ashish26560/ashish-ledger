import { describe, expect, it } from "vitest";
import { types } from "@neondatabase/serverless";
// Importing this module registers the DATE/TIMESTAMP* type-parser overrides
// below as a side effect — no DATABASE_URL or live connection needed, since
// that registration happens unconditionally at module load, separate from
// the lazy `sql` client construction.
import "@/lib/db";

// Regression test for a real bug: the driver's default type parsers turn
// DATE/TIMESTAMP columns into JS `Date` objects, which silently broke every
// place this app treats `transaction.Date` as a plain "YYYY-MM-DD" string
// (month-dropdown labels came out as "Invalid Date" once this ran against a
// real database for the first time).
describe("lib/db — DATE/TIMESTAMP type parser overrides", () => {
  it("keeps DATE columns as the raw string Postgres sent", () => {
    const parse = types.getTypeParser(types.builtins.DATE, "text");
    expect(parse("2026-04-01")).toBe("2026-04-01");
  });

  it("keeps TIMESTAMP and TIMESTAMPTZ columns as raw strings too", () => {
    expect(types.getTypeParser(types.builtins.TIMESTAMP, "text")("2026-04-01 10:00:00")).toBe(
      "2026-04-01 10:00:00"
    );
    expect(types.getTypeParser(types.builtins.TIMESTAMPTZ, "text")("2026-04-01T10:00:00Z")).toBe(
      "2026-04-01T10:00:00Z"
    );
  });
});
