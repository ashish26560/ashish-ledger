// Domain constants: the fixed set of categories the app understands, and
// which of them represent money moving that isn't really "spend" (salary,
// interest, transfers between your own accounts, reimbursements) and so
// should be excluded from expense totals.

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
] as const;

// The single source of truth for what a "Category" is — every place in the
// app that used to accept a bare `string` for a category now gets checked
// against this list.
export type Category = (typeof CATEGORY_ORDER)[number];

export const EXCLUDED_FROM_EXPENSE: ReadonlySet<Category> = new Set<Category>([
  "Self Transfer",
  "Income - Salary",
  "Income - Other",
  "Income - Interest",
  "Income - Group Reimbursement",
]);

export function isCategory(value: string): value is Category {
  return (CATEGORY_ORDER as readonly string[]).includes(value);
}
