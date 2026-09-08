# Ashish's Ledger

A personal expense tracker for your HDFC and SBI accounts — passbook-style
dashboard, filterable transaction ledger, recurring obligations breakdown,
and account balances. Built with Next.js 14 + Tailwind + Recharts.

Your March–September 2026 transaction history is pre-loaded as starting
data. Everything you add afterwards (new expenses, category edits, balance
updates) is saved in your browser's local storage — nothing is sent to a
server, so it stays private to your device/browser.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

**Easiest — no command line needed:**

1. Create a free account at https://vercel.com (sign in with GitHub, GitLab, or email)
2. Push this folder to a new GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. In Vercel, click **Add New → Project**, select your repository, and click **Deploy**
   (Vercel auto-detects Next.js — no configuration needed)
4. You'll get a live URL like `your-app.vercel.app` in about a minute

**Alternative — Vercel CLI:**

```bash
npm install -g vercel
vercel login
vercel --prod
```

## Pages

- **Dashboard** — total balance, monthly spend chart, category breakdown, recent activity
- **Transactions** — full filterable ledger (month/category/account/search) with a live total
- **Recurring** — EMIs, subscriptions, and insurance premiums broken out separately
- **Accounts** — per-account balances and totals; update balances as new statements come in

## Notes

- Data lives in your browser only (localStorage) — clearing browser data will reset it.
  To back up, you can export by opening dev tools console and running:
  `copy(localStorage.getItem('ledger:transactions:v1'))`
- To wipe and reload the original seed data, clear your browser's localStorage for this site.
