// @vitest-environment node
//
// These guard the property that matters most once more than one account can
// exist: your ledger is yours. Every data route must (a) refuse anonymous
// callers and (b) carry the signed-in user's id into the SQL, so no query can
// ever see or touch another account's rows.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const ALICE = "user-alice";

// Captures the values interpolated into each tagged-template query, so a test
// can assert the user id actually reached the database layer.
const { sqlMock, queries, rows } = vi.hoisted(() => {
  const queries: { text: string; values: unknown[] }[] = [];
  const rows: unknown[][] = [];
  const sqlMock = Object.assign(
    vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ text: Array.isArray(strings) ? strings.join("?") : String(strings), values });
      return rows.shift() ?? [];
    }),
    { unsafe: (value: string) => value }
  );
  return { sqlMock, queries, rows };
});

vi.mock("@/lib/db", () => ({ sql: sqlMock }));

// next/headers' cookies() isn't available outside a request scope in tests.
const { cookieStore } = vi.hoisted(() => ({ cookieStore: { value: undefined as string | undefined } }));
vi.mock("next/headers", () => ({
  cookies: () => ({ get: (name: string) => (name === SESSION_COOKIE && cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

async function signIn(userId = ALICE) {
  cookieStore.value = await createSessionToken(
    { userId, email: `${userId}@example.com`, exp: Date.now() + 60_000 },
    SECRET
  );
}

function signOut() {
  cookieStore.value = undefined;
}

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  queries.length = 0;
  rows.length = 0;
  sqlMock.mockClear();
  process.env.AUTH_SECRET = SECRET;
  signOut();
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

describe("anonymous callers are refused before any query runs", () => {
  it("GET /api/transactions", async () => {
    const { GET } = await import("@/app/api/transactions/route");
    const response = await GET();
    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("GET /api/balances", async () => {
    const { GET } = await import("@/app/api/balances/route");
    const response = await GET();
    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("DELETE /api/transactions/[id]", async () => {
    const { DELETE } = await import("@/app/api/transactions/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/transactions/t1", { method: "DELETE" }), {
      params: { id: "t1" },
    });
    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});

describe("queries are scoped to the signed-in user", () => {
  it("reads only that user's transactions", async () => {
    await signIn();
    const { GET } = await import("@/app/api/transactions/route");
    await GET();

    expect(queries[0].text).toContain("user_id =");
    expect(queries[0].values).toContain(ALICE);
  });

  it("reads only that user's balances", async () => {
    await signIn();
    const { GET } = await import("@/app/api/balances/route");
    await GET();

    expect(queries[0].text).toContain("user_id =");
    expect(queries[0].values).toContain(ALICE);
  });

  it("stamps new transactions with the creator's id rather than trusting the body", async () => {
    await signIn();
    rows.push([{ id: "t1", date: "2026-09-09", time: null, account: "A", description: "d", full_description: "", category: "Grocery", subcategory: "", type: "Debit", amount: "1", balance: null }]);

    const { POST } = await import("@/app/api/transactions/route");
    // The body even claims a different owner — it must be ignored.
    await POST(jsonRequest("http://localhost/api/transactions", {
      transactions: [{ Date: "2026-09-09", Account: "A", Description: "d", Category: "Grocery", Type: "Debit", Amount: 1, user_id: "user-mallory" }],
    }));

    expect(queries[0].text).toContain("INSERT INTO transactions");
    expect(queries[0].values).toContain(ALICE);
    expect(queries[0].values).not.toContain("user-mallory");
  });

  it("writes balances keyed on the user, so two accounts can hold the same account name", async () => {
    await signIn();
    const { PUT } = await import("@/app/api/balances/route");
    await PUT(jsonRequest("http://localhost/api/balances", { account: "HDFC ...9939", balance: 100, asOf: "2026-09-09" }, "PUT"));

    expect(queries[0].text).toContain("ON CONFLICT (user_id, account)");
    expect(queries[0].values).toContain(ALICE);
  });
});

describe("one account cannot reach another's rows", () => {
  it("PATCH reports not-found when the id belongs to someone else", async () => {
    await signIn();
    rows.push([]); // the UPDATE ... AND user_id matched nothing

    const { PATCH } = await import("@/app/api/transactions/[id]/route");
    const response = await PATCH(
      jsonRequest("http://localhost/api/transactions/someone-elses-id", { Category: "Fuel" }, "PATCH"),
      { params: { id: "someone-elses-id" } }
    );

    expect(response.status).toBe(404);
    expect(queries[0].text).toContain("user_id =");
    expect(queries[0].values).toContain(ALICE);
  });

  it("DELETE reports not-found when the id belongs to someone else", async () => {
    await signIn();
    rows.push([]); // nothing deleted

    const { DELETE } = await import("@/app/api/transactions/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/transactions/x", { method: "DELETE" }), {
      params: { id: "someone-elses-id" },
    });

    expect(response.status).toBe(404);
    expect(queries[0].values).toContain(ALICE);
  });

  it("a session signed with the wrong secret is treated as anonymous", async () => {
    cookieStore.value = await createSessionToken(
      { userId: "forged", email: "f@example.com", exp: Date.now() + 60_000 },
      "a-completely-different-secret-32-chars-x"
    );

    const { GET } = await import("@/app/api/transactions/route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
