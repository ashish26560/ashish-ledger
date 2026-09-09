// One-time migration: loads the pre-loaded transaction history and the two
// starting account balances into Postgres. Run this once, locally, after
// you've created the tables (db/schema.sql) and have DATABASE_URL available.
//
//   vercel env pull .env.development.local
//   node --env-file=.env.development.local scripts/seed.mjs
//
// (Node 20.6+ supports --env-file directly; on an older Node, `export
// DATABASE_URL=...` from .env.development.local yourself first instead.)
//
// Safe to re-run: it refuses to touch the transactions table if it already
// has rows, so it can't accidentally double-insert your history. The two
// balance rows are upserted either way.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Run `vercel env pull .env.development.local` first, then:\n" +
      "  node --env-file=.env.development.local scripts/seed.mjs"
  );
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Mirrors the DEFAULT_BALANCES that used to live in lib/DataContext.js —
// the starting point before the app switched from localStorage to Postgres.
const DEFAULT_BALANCES = {
  "HDFC ...9939": { balance: 24424.11, asOf: "2026-09-07" },
  "SBI ...1933": { balance: 76215.79, asOf: "2026-09-07" },
};

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM transactions`;
  if (count > 0) {
    console.log(
      `transactions table already has ${count} row(s) — refusing to reseed. ` +
        "Nothing was changed. (Delete the table's rows yourself first if you really want to reload the seed.)"
    );
  } else {
    const seedPath = path.join(__dirname, "..", "data", "transactions.json");
    const seedTransactions = JSON.parse(readFileSync(seedPath, "utf8"));
    console.log(`Inserting ${seedTransactions.length} transactions...`);

    let inserted = 0;
    for (const batch of chunk(seedTransactions, 25)) {
      await Promise.all(
        batch.map((tx) =>
          sql`
            INSERT INTO transactions (id, date, time, account, description, category, subcategory, type, amount, balance)
            VALUES (
              ${tx.id}, ${tx.Date}, ${tx.Time || null}, ${tx.Account}, ${tx.Description},
              ${tx.Category}, ${tx.Subcategory || ""}, ${tx.Type}, ${tx.Amount},
              ${tx.Balance === "" || tx.Balance == null ? null : tx.Balance}
            )
            ON CONFLICT (id) DO NOTHING
          `
        )
      );
      inserted += batch.length;
      process.stdout.write(`\r  ${inserted}/${seedTransactions.length}`);
    }
    console.log("\nDone inserting transactions.");
  }

  console.log("Setting starting account balances...");
  for (const [account, { balance, asOf }] of Object.entries(DEFAULT_BALANCES)) {
    await sql`
      INSERT INTO balances (account, balance, as_of)
      VALUES (${account}, ${balance}, ${asOf})
      ON CONFLICT (account) DO UPDATE SET balance = EXCLUDED.balance, as_of = EXCLUDED.as_of
    `;
  }
  console.log("Done. Your database now has your full transaction history and starting balances.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
