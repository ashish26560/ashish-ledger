-- Ashish's Ledger — Postgres schema (Neon)
--
-- Run this once against your Neon database before using the app with a
-- database backend. In the Neon console's SQL editor (or via `psql
-- "$DATABASE_URL" -f db/schema.sql`), paste/run this whole file.

CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY,
  date              DATE NOT NULL,
  time              TEXT,               -- "HH:MM", optional (bank imports have no time)
  account           TEXT NOT NULL,
  description       TEXT NOT NULL,
  full_description  TEXT NOT NULL DEFAULT '', -- untruncated bank narration; '' for older/manual rows
  category          TEXT NOT NULL,
  subcategory       TEXT NOT NULL DEFAULT '',
  type              TEXT NOT NULL CHECK (type IN ('Debit', 'Credit')),
  amount            NUMERIC(14, 2) NOT NULL,
  balance           NUMERIC(14, 2),     -- running balance from a bank statement, if known
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added after the table already existed in production — safe to re-run
-- (IF NOT EXISTS) whether this is a brand-new database or one that already
-- has rows. This is this project's whole "migration" story: schema.sql
-- stays append-only, and you just re-run the file after pulling changes.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS full_description TEXT NOT NULL DEFAULT '';

-- Every list/filter view sorts or scopes by these, so index them.
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date, time);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions (account);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);

-- NOT unique: real same-day transactions can legitimately share the same
-- date/account/type/amount/description (e.g. three separate payments to the
-- same truncated payee name for the same amount on the same day). This index
-- just makes the API's own duplicate-check query fast; de-dup logic lives in
-- the application (app/api/transactions/route.js), same as it did against
-- localStorage.
CREATE INDEX IF NOT EXISTS idx_transactions_signature
  ON transactions (date, account, type, amount, description);

CREATE TABLE IF NOT EXISTS balances (
  account       TEXT PRIMARY KEY,
  balance       NUMERIC(14, 2) NOT NULL,
  as_of         DATE NOT NULL
);

-- Sign-in accounts. Passwords are stored as PBKDF2-HMAC-SHA256 hashes with a
-- per-user random salt (see lib/auth.ts) — never in plain text, and never
-- reversible. Emails are stored lower-cased so sign-in isn't case-sensitive.
--
-- The first account is created through the app's own setup screen, which only
-- works while this table is empty; after that, registration is closed. To add
-- another person later, insert a row yourself or temporarily clear this table.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
