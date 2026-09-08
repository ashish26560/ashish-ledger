export const EXCLUDED_FROM_EXPENSE = new Set([
  "Self Transfer",
  "Income - Salary",
  "Income - Other",
  "Income - Interest",
  "Income - Group Reimbursement",
]);

export const CATEGORY_ORDER = [
  "Grocery",
  "Food & Dining",
  "Fuel",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Electrical/Utilities",
  "Health & Medical",
  "Personal Care",
  "Home Rent",
  "Loan EMI",
  "Credit Card Payment",
  "Insurance",
  "Subscriptions",
  "Cash Withdrawal",
  "Gifts & Flowers",
  "Spiritual/Astrology",
  "Other / Personal Transfer",
  "Self Transfer",
  "Income - Salary",
  "Income - Interest",
  "Income - Other",
  "Income - Group Reimbursement",
];

export function categoryRank(cat) {
  const i = CATEGORY_ORDER.indexOf(cat);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

export function formatINR(amount, opts = {}) {
  const n = Number(amount) || 0;
  const { signed = false } = opts;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const sign = signed ? (n < 0 ? "-" : n > 0 ? "+" : "") : "";
  return `${sign}\u20B9${formatted}`;
}

export function monthLabel(monthStr) {
  // monthStr like "2026-06"
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function isExpenseRow(tx) {
  return !EXCLUDED_FROM_EXPENSE.has(tx.Category);
}

export function computeMonthlyNet(transactions) {
  const byMonth = {};
  for (const tx of transactions) {
    if (!isExpenseRow(tx)) continue;
    const amt = tx.Type === "Debit" ? Number(tx.Amount) : -Number(tx.Amount);
    // Net expense = debits minus credits within expense categories
    byMonth[tx.Month] = (byMonth[tx.Month] || 0) + amt;
  }
  return byMonth;
}

export function computeCategoryTotals(transactions, monthFilter) {
  const totals = {};
  for (const tx of transactions) {
    if (monthFilter && tx.Month !== monthFilter) continue;
    if (tx.Type !== "Debit") continue;
    totals[tx.Category] = (totals[tx.Category] || 0) + Number(tx.Amount);
  }
  return totals;
}

export function uniqueMonths(transactions) {
  return Array.from(new Set(transactions.map((t) => t.Month))).sort();
}

export function uniqueCategories(transactions) {
  return Array.from(new Set(transactions.map((t) => t.Category))).sort(
    (a, b) => categoryRank(a) - categoryRank(b)
  );
}

export function uniqueAccounts(transactions) {
  return Array.from(new Set(transactions.map((t) => t.Account))).sort();
}
