import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";

type SqlClient = NeonQueryFunction<false, false>;

// The driver's default type parsers convert DATE/TIMESTAMP columns into JS
// `Date` objects (same behavior as node-postgres). That's exactly wrong for
// this app: `transactions.date` is meant to stay a plain "YYYY-MM-DD"
// string everywhere (Transaction.Date is typed as ISODate = string, and
// things like compareDateTime and the Month-derivation below do direct
// string slicing/comparison). Handing back a Date object instead silently
// broke those — `String(dateObject).slice(0, 7)` doesn't produce "YYYY-MM",
// it produces garbage like "Tue Apr" from Date.prototype.toString(), which
// is why month dropdowns started showing "Invalid Date" once this ran
// against a real database for the first time. Registering these overrides
// once, at module load, keeps every DATE/TIMESTAMP*/TIME column as the raw
// string Postgres sent, for every query made through this file.
for (const oid of [types.builtins.DATE, types.builtins.TIMESTAMP, types.builtins.TIMESTAMPTZ]) {
  types.setTypeParser(oid, (value: string) => value);
}

// Lazy on purpose: constructing the real client eagerly at module scope
// would throw immediately if DATABASE_URL isn't set yet (neon(undefined)
// throws synchronously), which would take down every route that imports
// this file — including at build time, before you've ever provisioned a
// database. Deferring construction to first actual query means a missing
// DATABASE_URL only breaks the specific request that needed it, with a
// clear error, not the whole app.
let cachedClient: SqlClient | null = null;

function getClient(): SqlClient {
  if (!cachedClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add the Neon integration to this project on Vercel " +
          "(or run `vercel env pull .env.development.local` locally) — see README 'Database setup'."
      );
    }
    // `cache: "no-store"` is load-bearing, not a nicety. This driver talks to
    // Neon over HTTP using the global `fetch`, and Next.js patches `fetch` to
    // route it through the Data Cache — which is keyed by the request (so, by
    // the SQL text) and, unlike the CDN cache, PERSISTS ACROSS DEPLOYMENTS.
    // Without this, a query whose SQL string never changes gets answered from
    // that cache indefinitely: `GET /api/balances` kept serving a deleted row
    // for days while the identical query with one extra column in the SELECT
    // list (a different cache key, so a real round trip) correctly returned
    // nothing. Redeploying didn't clear it, `X-Vercel-Cache: MISS` didn't
    // reveal it (that header only describes the CDN layer, and the function
    // really was running — it was the fetch inside it being cached), and
    // `export const dynamic = "force-dynamic"` on the routes didn't stop it.
    // Opting out here, at the one place the client is built, covers every
    // query in the app rather than relying on per-route configuration.
    cachedClient = neon(connectionString, { fetchOptions: { cache: "no-store" } });
  }
  return cachedClient;
}

// Proxied so every call site can keep writing `sql\`...\`` / `sql.unsafe(...)`
// exactly like the real neon() client, without every route needing to call a
// getter first. The `as unknown as SqlClient` cast is the one place this
// file steps outside the type system — everywhere else, `sql` behaves
// exactly like a real `NeonQueryFunction`.
export const sql: SqlClient = new Proxy(function sql() {} as unknown as SqlClient, {
  apply(_target, _thisArg, args: unknown[]) {
    const client = getClient() as unknown as (...a: unknown[]) => unknown;
    return client(...args);
  },
  get(_target, prop: keyof SqlClient) {
    return getClient()[prop];
  },
}) as unknown as SqlClient;
