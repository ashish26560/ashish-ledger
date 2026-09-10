import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so no real connection is attempted — this test only cares about the
// options `lib/db.ts` hands to `neon()` when it builds the client.
const { neonFactory } = vi.hoisted(() => ({
  neonFactory: vi.fn((_connectionString: string, _options?: Record<string, unknown>) => vi.fn()),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: neonFactory,
  types: {
    setTypeParser: vi.fn(),
    getTypeParser: vi.fn(),
    builtins: { DATE: 1082, TIMESTAMP: 1114, TIMESTAMPTZ: 1184 },
  },
}));

// Regression test for a genuinely nasty bug. The Neon HTTP driver queries via
// the global `fetch`, which Next.js patches to route through its Data Cache.
// That cache is keyed by the request — so by the SQL text — and survives
// redeploys. A query whose SQL never varies (`SELECT account, balance, as_of
// FROM balances`) therefore kept returning a row that had already been
// deleted, indefinitely, while the same query with one extra column returned
// the correct empty result. Nothing about it looked like caching from the
// outside: the CDN reported `X-Vercel-Cache: MISS`, the function really was
// executing, and the routes already declared `dynamic = "force-dynamic"`.
describe("lib/db — Next.js Data Cache opt-out", () => {
  beforeEach(() => {
    vi.resetModules();
    neonFactory.mockClear();
    process.env.DATABASE_URL = "postgresql://user:pass@example.neon.tech/neondb";
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("builds the client with cache: no-store so stale rows can't be served from the Data Cache", async () => {
    const { sql } = await import("@/lib/db");

    // The client is constructed lazily, on first use of the proxy.
    void sql.transaction;

    expect(neonFactory).toHaveBeenCalledTimes(1);
    const [, options] = neonFactory.mock.calls[0];
    expect(options).toMatchObject({ fetchOptions: { cache: "no-store" } });
  });
});
