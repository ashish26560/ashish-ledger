// Spotting shared pots in a statement before you have to.
//
// The shape is distinctive: a big payment and a comparable amount moving the
// other way within a few days. ₹20,000 in from Shah Krish and ₹16,443 out to
// Airbnb on the same day; ₹10,000 out to Krishna Soni on the 4th and ₹4,000
// back on the 11th. Neither is a coincidence, and neither is your spending.
//
// This only proposes. Every suggestion is confirmed by hand in the import
// preview, because the same shape also fits a genuine payment that happens to
// be near a genuine refund, and getting that wrong quietly understates what
// you spent.

/** The subset of a row this needs — works on import candidates and on saved transactions alike. */
export interface PairCandidate {
  Date: string;
  Type: "Debit" | "Credit";
  Amount: number;
  Description: string;
}

export interface PotSuggestion {
  /** Indices into the array passed in. */
  debitIndex: number;
  creditIndex: number;
  /** Proposed pot name — the payee, since that's what the pot is about. */
  name: string;
  /** What you'd actually be left paying if these two are a pair. */
  yourCost: number;
  /** Days between the two, for the UI to show why this was suggested. */
  daysApart: number;
}

/** Small change isn't worth potting, and pairing it produces noise. */
export const MIN_PAIR_AMOUNT = 1000;
/** Beyond this the two are unlikely to be about the same thing. */
export const MAX_DAYS_APART = 7;
/** The smaller side has to be a real fraction of the larger. */
export const MIN_AMOUNT_RATIO = 0.3;

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`));
  return Number.isNaN(ms) ? Infinity : Math.round(ms / 86_400_000);
}

/** Strip the noise a bank narration carries so the pot gets a readable name. */
export function suggestedName(description: string): string {
  const cleaned = description
    .replace(/\b\d{6,}\b/g, " ")
    .replace(/[*_/\\|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const short = cleaned.length > 40 ? `${cleaned.slice(0, 40).trimEnd()}…` : cleaned;
  return short || description.slice(0, 40);
}

/**
 * Pairs each debit with at most one credit, strongest match first.
 *
 * "Strongest" is same-day and closest in size, which is what makes the Airbnb
 * pair beat any accidental neighbour. A row can only be used once, so a
 * statement full of similar amounts produces a handful of suggestions rather
 * than a combinatorial pile.
 *
 * Deliberately 1:1. A dinner nine people repay separately is one debit and
 * nine credits, and guessing which nine would be wrong more often than right —
 * accept the pair it finds, then add the rest to the pot from the
 * transactions table.
 */
export function suggestPots(rows: PairCandidate[]): PotSuggestion[] {
  const debits: number[] = [];
  const credits: number[] = [];

  rows.forEach((row, i) => {
    if (Number(row.Amount) < MIN_PAIR_AMOUNT) return;
    (row.Type === "Debit" ? debits : credits).push(i);
  });

  interface ScoredPair extends PotSuggestion {
    score: number;
  }
  const scored: ScoredPair[] = [];

  for (const d of debits) {
    for (const c of credits) {
      const debit = rows[d];
      const credit = rows[c];
      const gap = daysBetween(debit.Date, credit.Date);
      if (gap > MAX_DAYS_APART) continue;

      const larger = Math.max(Number(debit.Amount), Number(credit.Amount));
      const smaller = Math.min(Number(debit.Amount), Number(credit.Amount));
      const ratio = larger === 0 ? 0 : smaller / larger;
      if (ratio < MIN_AMOUNT_RATIO) continue;

      scored.push({
        debitIndex: d,
        creditIndex: c,
        name: suggestedName(debit.Description),
        yourCost: Math.max(0, Number(debit.Amount) - Number(credit.Amount)),
        daysApart: gap,
        // Closeness in time dominates: a same-day pair is the strong signal,
        // and similarity in size breaks ties among equally close ones.
        score: (MAX_DAYS_APART - gap) * 10 + ratio * 5,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.debitIndex - b.debitIndex);

  const usedDebits = new Set<number>();
  const usedCredits = new Set<number>();
  const chosen: PotSuggestion[] = [];

  for (const pair of scored) {
    if (usedDebits.has(pair.debitIndex) || usedCredits.has(pair.creditIndex)) continue;
    usedDebits.add(pair.debitIndex);
    usedCredits.add(pair.creditIndex);
    const { score: _score, ...suggestion } = pair;
    void _score;
    chosen.push(suggestion);
  }

  return chosen.sort((a, b) => rows[a.debitIndex].Date.localeCompare(rows[b.debitIndex].Date));
}
