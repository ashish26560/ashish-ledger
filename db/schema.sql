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

-- ---------------------------------------------------------------------------
-- Ownership: tie every transaction and balance to the user it belongs to.
--
-- Added after both tables already existed. Until this ran, the ledger was
-- shared: any signed-in account could read and edit every row, because no
-- query filtered by user. Harmless while only one account could exist, but
-- wrong the moment a second one did.
--
-- Written to be safe to re-run, and safe on a database that already holds
-- data: the column is added nullable, existing rows are handed to the oldest
-- account, and NOT NULL is only enforced once nothing is left unassigned (so
-- re-running this on a database with rows but no users yet won't fail).
-- ---------------------------------------------------------------------------

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE balances     ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users (id) ON DELETE CASCADE;

UPDATE transactions
   SET user_id = (SELECT id FROM users ORDER BY created_at, id LIMIT 1)
 WHERE user_id IS NULL;

UPDATE balances
   SET user_id = (SELECT id FROM users ORDER BY created_at, id LIMIT 1)
 WHERE user_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM transactions WHERE user_id IS NULL) THEN
    ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM balances WHERE user_id IS NULL) THEN
    ALTER TABLE balances ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- `balances` was keyed on account alone, which would collide the moment two
-- people both had an "HDFC ...9939". The key is the pair. Guarded so re-runs
-- are no-ops once the swap has happened.
DO $$
DECLARE
  primary_key_columns text;
BEGIN
  -- A primary key can't include a nullable column, so this has to wait until
  -- every row has an owner. That's only outstanding when the table already had
  -- rows before any account existed — in which case, create your account and
  -- run this file once more to finish the job.
  IF EXISTS (SELECT 1 FROM balances WHERE user_id IS NULL) THEN
    RAISE NOTICE 'balances still has rows with no user_id — re-run this file after creating an account.';
    RETURN;
  END IF;

  SELECT string_agg(att.attname, ',' ORDER BY key.ord)
    INTO primary_key_columns
    FROM pg_constraint con
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS key(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = key.attnum
   WHERE con.conrelid = 'balances'::regclass AND con.contype = 'p';

  IF primary_key_columns = 'account' THEN
    ALTER TABLE balances DROP CONSTRAINT balances_pkey;
    ALTER TABLE balances ADD PRIMARY KEY (user_id, account);
  END IF;
END $$;

-- Every list view now filters by user first, so the useful indexes lead with it.
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date, time);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions (user_id, category);
