// Categorizes freshly-imported transactions the same way the existing ledger
// was categorized: learn from what's already been categorized (exact payee
// match), then fall back to structural/merchant rules, then a plain default
// that's easy to fix by hand in the import preview.

import { isCategory, type Category } from "@/lib/categories";
import type { CategorizedCandidate, CategoryConfidence, StatementCandidate, Transaction, TransactionType } from "@/lib/types";

function normalizeKey(description: string): string {
  return String(description || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface StructuralRule {
  test: RegExp;
  category: Category;
}

// Deterministic transaction-type rules that don't depend on merchant identity.
const STRUCTURAL_RULES: StructuralRule[] = [
  { test: /^SALARY\b/i, category: "Income - Salary" },
  { test: /^(EMI|DPI)\b.*\bCHQ\b/i, category: "Loan EMI" },
  { test: /EMI RTN CHARGES/i, category: "Loan EMI" },
  { test: /OVERDUE LOAN/i, category: "Loan EMI" },
  { test: /^CC \d.*AUTOPAY/i, category: "Credit Card Payment" },
  { test: /^INTEREST (PAID|CREDIT)/i, category: "Income - Interest" },
  { test: /^NWD-/i, category: "Cash Withdrawal" },
];

interface KeywordRule {
  category: Category;
  words: string[];
}

// Recognizable merchants/brands, grouped by category. Matched against the
// cleaned description (case-insensitive substring).
const KEYWORD_RULES: KeywordRule[] = [
  { category: "Grocery", words: ["ZEPTO", "BLINKIT", "BIGBASKET", "JIOMART", "DMART", "DAIRY"] },
  {
    category: "Food & Dining",
    words: ["ZOMATO", "SWIGGY", "EATSURE", "DOMINOS", "MCDONALD", "KFC", "PIZZA", "CAFE", "RESTAURANT", "BUNDL TECHNOLOGIES"],
  },
  { category: "Fuel", words: ["PETROLEUM", "PETROL", "FILLING STATION", "FUEL"] },
  { category: "Transport", words: ["RAPIDO", "OLA ", "UBER", "IRCTC", "STATE ROAD T", "BIKE SHAR"] },
  { category: "Personal Care", words: ["SALON", " SPA", "BARBER", "HAIR ART"] },
  { category: "Health & Medical", words: ["MEDICAL", "PHARMA", "HOSPITAL", "CLINIC", "DIAGNOSTIC"] },
  {
    category: "Subscriptions",
    words: ["NETFLIX", "SPOTIFY", "HOTSTAR", "PRIME VIDEO", "YOUTUBE PREMIUM", "GOOGLE PLAY", "ADOBE", "APPLE.COM"],
  },
  { category: "Insurance", words: ["INSURANCE", "LIC PREMIUM", "POSTAL LIFE"] },
  { category: "Bills & Utilities", words: ["AIRTEL", "JIO", "VODAFONE", "VI PREPAID", "BROADBAND", "VIJ CO"] },
  {
    category: "Shopping",
    words: ["AMAZON", "FLIPKART", "MYNTRA", "AJIO", "ZUDIO", "WESTSIDE", "TRENDS ", "DECATHLON", "LENSKART", "SNITCH"],
  },
  { category: "Gifts & Flowers", words: ["FLORIST", "GIFT SHOP"] },
  { category: "Spiritual/Astrology", words: ["ASTRO", "INSTAASTRO", "PUJA"] },
];

// Keyed by description + direction (Debit/Credit) rather than description
// alone: the same payee can show up both ways (you pay them, they pay you
// back) and those two directions usually belong in different categories —
// e.g. a reimbursement coming in vs. a personal transfer going out.
function learnedKey(description: string, type: TransactionType): string | null {
  const key = normalizeKey(description);
  return key ? `${key}::${type}` : null;
}

export type LearnedCategoryMap = Map<string, Category>;

export function buildLearnedCategoryMap(existingTransactions: Transaction[]): LearnedCategoryMap {
  const counts = new Map<string, Map<Category, number>>();
  for (const tx of existingTransactions || []) {
    const key = learnedKey(tx.Description, tx.Type);
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, new Map());
    const catCounts = counts.get(key)!;
    catCounts.set(tx.Category, (catCounts.get(tx.Category) || 0) + 1);
  }
  const learned: LearnedCategoryMap = new Map();
  for (const [key, catCounts] of counts) {
    let best: Category | null = null;
    let bestCount = -1;
    for (const [cat, n] of catCounts) {
      if (n > bestCount) {
        best = cat;
        bestCount = n;
      }
    }
    if (best) learned.set(key, best);
  }
  return learned;
}

export interface CategorizationResult {
  category: Category;
  confidence: CategoryConfidence;
}

export function categorizeTransaction(candidate: StatementCandidate, learnedMap: LearnedCategoryMap): CategorizationResult {
  const { RawNarration, Description, Type } = candidate;

  for (const rule of STRUCTURAL_RULES) {
    if (rule.test.test(RawNarration || Description)) {
      return { category: rule.category, confidence: "rule" };
    }
  }

  const key = learnedKey(Description, Type);
  if (key && learnedMap.has(key)) {
    return { category: learnedMap.get(key)!, confidence: "learned" };
  }

  const upper = (Description || "").toUpperCase();
  for (const group of KEYWORD_RULES) {
    if (group.words.some((w) => upper.includes(w))) {
      return { category: group.category, confidence: "rule" };
    }
  }

  return {
    category: Type === "Credit" ? "Income - Other" : "Other / Personal Transfer",
    confidence: "fallback",
  };
}

export function categorizeAll(candidates: StatementCandidate[], existingTransactions: Transaction[]): CategorizedCandidate[] {
  const learnedMap = buildLearnedCategoryMap(existingTransactions);
  return candidates.map((c) => ({ ...c, ...categorizeTransaction(c, learnedMap) }));
}

// Re-exported for tests that want to sanity-check a raw category value
// coming back from the database or an older seed file.
export { isCategory };
