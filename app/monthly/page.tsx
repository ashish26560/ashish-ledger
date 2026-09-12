"use client";

import { useMemo, useState } from "react";
import { useLedger } from "@/lib/DataContext";
import { formatDate, formatINR, monthLabel, uniqueAccounts } from "@/lib/data";
import {
  BIG_PAYMENT_FLOOR,
  buildMonthSummaries,
  foldCategoryTail,
  formatSignedINR,
  type MonthSummary,
} from "@/lib/monthly";
import { buildPots, type Pot } from "@/lib/pots";
import Select from "@/components/Select";
import MonthComparisonChart from "@/components/MonthComparisonChart";
import type { Transaction } from "@/lib/types";

export default function MonthlyPage() {
  const { transactions } = useLedger();

  const accounts = useMemo(() => uniqueAccounts(transactions), [transactions]);
  const summaries = useMemo(() => buildMonthSummaries(transactions, accounts), [transactions, accounts]);

  const latest = summaries.length ? summaries[summaries.length - 1].month : "";
  const [selectedMonth, setSelectedMonth] = useState(latest);
  const current = summaries.find((s) => s.month === selectedMonth) ?? summaries[summaries.length - 1];

  const chartData = useMemo(
    () =>
      summaries.map((s) => ({
        month: s.month,
        label: s.label,
        spent: Math.round(s.spent),
        moneyIn: Math.round(s.salary + s.otherIn),
      })),
    [summaries]
  );

  const monthOptions = useMemo(() => summaries.map((s) => ({ value: s.month, label: s.label })), [summaries]);

  // The month you're living in is only ever a part month, so its "left over"
  // is a running figure, not a result. Said out loud rather than left for the
  // reader to remember. Built from local date parts — toISOString() would roll
  // over a day early on the 1st for anyone east of UTC, which is everyone here.
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (!current) {
    return (
      <div className="px-4 md:px-10 py-6 md:py-8 max-w-5xl">
        <h1 className="font-display text-2xl md:text-3xl">Monthly</h1>
        <p className="text-sm text-muted mt-3">
          Nothing to summarise yet — import a statement or add a transaction and this page fills in.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-10 py-6 md:py-8 max-w-5xl">
      <header className="mb-5 md:mb-6">
        <h1 className="font-display text-2xl md:text-3xl">Monthly</h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          What went out, what came in, and what that did to your balance — one month at a time. Money moved
          between your own accounts is left out of every figure; it was never spending.
        </p>
      </header>

      <section className="mb-8 md:mb-10">
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3 md:mb-4">
          <h2 className="font-display text-lg md:text-xl">Every month side by side</h2>
          <p className="flex gap-4 text-xs md:text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rust" aria-hidden="true" />
              Money out
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-forest" aria-hidden="true" />
              Money in
            </span>
          </p>
        </div>
        <div className="border border-line rounded bg-paper p-3 md:p-5">
          <MonthComparisonChart data={chartData} selected={current.month} onSelect={setSelectedMonth} />
        </div>
        <p className="text-xs text-muted mt-2">Tap a month to open it below.</p>
      </section>

      <MonthHeadline
        summary={current}
        options={monthOptions}
        onSelect={setSelectedMonth}
        inProgress={current.month === thisMonth}
      />

      <SharedPots summary={current} allTransactions={transactions} />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-10">
        <WhereItWent summary={current} />
        <BiggestPayments summary={current} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <AccountSplitPanel summary={current} />
        <OtherMoneyIn summary={current} />
      </section>
    </div>
  );
}

// --- the month's headline figure, and the arithmetic behind it --------------

function MonthHeadline({
  summary,
  options,
  onSelect,
  inProgress,
}: {
  summary: MonthSummary;
  options: { value: string; label: string }[];
  onSelect: (month: string) => void;
  inProgress: boolean;
}) {
  const drawnDown = summary.net < 0;

  return (
    <section className="mb-8 md:mb-10">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="font-display text-xl md:text-2xl">{summary.label}</h2>
          {inProgress && (
            <span className="text-[11px] font-mono uppercase tracking-wider text-gold border border-gold rounded-full px-2 py-0.5">
              Still in progress
            </span>
          )}
        </div>
        <Select
          label="Month"
          value={summary.month}
          onChange={onSelect}
          options={options}
          align="right"
          className="font-mono"
        />
      </div>

      <div className="border border-line rounded bg-paper px-4 py-5 md:px-6 md:py-6">
        <p className="text-xs text-muted mb-1.5">
          {inProgress ? "So far this month" : drawnDown ? "Drawn from savings" : "Left over at month end"}
        </p>
        <p
          className={`font-mono tabular text-3xl md:text-4xl leading-none break-all ${
            drawnDown ? "text-rust" : "text-forestDeep"
          }`}
        >
          {formatSignedINR(summary.net)}
        </p>
        <p className="text-sm text-muted mt-3 max-w-xl">
          {drawnDown
            ? `You spent ${formatINR(summary.spent)} against ${formatINR(
                summary.salary + summary.otherIn
              )} coming in, so the difference came out of the balance you already had.`
            : `You spent ${formatINR(summary.spent)} against ${formatINR(
                summary.salary + summary.otherIn
              )} coming in, so the balance grew.`}
        </p>

        {/* The same figure again, as the sum it actually is — so the headline
            is checkable rather than something the page just asserts. */}
        <dl className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded overflow-hidden">
          <Term label="Salary" value={formatINR(summary.salary)} tone="in" />
          <Term label="Other money in" value={formatINR(summary.otherIn)} tone="in" />
          <Term label="Spent" value={formatINR(summary.spent)} tone="out" />
          <Term label="Left over" value={formatSignedINR(summary.net)} tone={drawnDown ? "out" : "in"} />
        </dl>
      </div>
    </section>
  );
}

function Term({ label, value, tone }: { label: string; value: string; tone: "in" | "out" }) {
  return (
    <div className="bg-paper px-3 py-2.5">
      <dt className="text-[11px] text-muted mb-1">{label}</dt>
      <dd className={`font-mono tabular text-sm md:text-base break-all ${tone === "out" ? "text-rust" : "text-forestDeep"}`}>
        {value}
      </dd>
    </div>
  );
}

// --- shared pots ------------------------------------------------------------

/**
 * Only rendered when the month has pots, because for most months it would be
 * an empty box explaining a feature you aren't using.
 *
 * Two figures per pot, and they answer different questions. The month figures
 * are what the bank saw happen in these thirty days. The lifetime figures are
 * what the whole thing cost you, which for a pot still being settled is the
 * one you actually want — so both are shown rather than picking one.
 */
function SharedPots({ summary, allTransactions }: { summary: MonthSummary; allTransactions: Transaction[] }) {
  const lifetime = useMemo(() => {
    const byName = new Map(buildPots(allTransactions).map((p) => [p.name, p]));
    return summary.pots.map((monthPot) => ({ monthPot, whole: byName.get(monthPot.name) ?? monthPot }));
  }, [allTransactions, summary.pots]);

  if (summary.pots.length === 0) return null;

  return (
    <section className="mb-8 md:mb-10" aria-labelledby="pots-h">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3 md:mb-4">
        <h2 className="font-display text-lg md:text-xl" id="pots-h">
          Shared pots
        </h2>
        <p className="text-xs text-muted">Money that passed through, minus what was actually yours</p>
      </div>
      <div className="border border-line rounded bg-paper divide-y divide-line">
        {lifetime.map(({ monthPot, whole }) => (
          <PotRow key={monthPot.name} monthPot={monthPot} whole={whole} monthLabelText={summary.label} />
        ))}
      </div>
      {summary.potHeld > 0 && (
        <p className="text-xs text-muted mt-2">
          {formatINR(summary.potHeld)} of what came in this month isn&apos;t yours — it&apos;s counted as money in,
          not as spending.
        </p>
      )}
    </section>
  );
}

function PotRow({ monthPot, whole, monthLabelText }: { monthPot: Pot; whole: Pot; monthLabelText: string }) {
  const spansMonths = whole.months.length > 1;

  return (
    <div className="px-4 py-3.5">
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <span className="text-sm font-medium">{monthPot.name}</span>
        <span className="font-mono tabular text-sm shrink-0">
          {monthPot.cost > 0 ? (
            <span className="text-rust">{formatINR(monthPot.cost)} yours</span>
          ) : (
            <span className="text-forestDeep">{formatINR(monthPot.held)} held for others</span>
          )}
        </span>
      </div>
      <p className="text-xs text-muted mt-1">
        {monthLabelText}: {formatINR(monthPot.out)} out · {formatINR(monthPot.in)} in · {monthPot.category}
      </p>
      {spansMonths && (
        <p className="text-xs text-muted mt-1">
          Across {whole.months.length} months: {formatINR(whole.out)} out · {formatINR(whole.in)} in ·{" "}
          {whole.cost > 0 ? `${formatINR(whole.cost)} yours so far` : `${formatINR(whole.held)} still held`}
        </p>
      )}
    </div>
  );
}

// --- where it went ----------------------------------------------------------

function WhereItWent({ summary }: { summary: MonthSummary }) {
  const { head, tail } = foldCategoryTail(summary.categories);
  const max = Math.max(...head.map(([, v]) => v), 1);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 md:mb-4">
        <h2 className="font-display text-lg md:text-xl">Where it went</h2>
        <p className="text-xs text-muted">{summary.txnCount} payments</p>
      </div>
      <div className="border border-line rounded bg-paper p-4 md:p-5">
        {head.length === 0 && <p className="text-sm text-muted py-4">Nothing went out this month.</p>}
        <div className="space-y-3">
          {head.map(([category, amount]) => (
            <div key={category}>
              <div className="flex justify-between items-baseline gap-3 mb-1">
                <span className="text-sm">{category}</span>
                <span className="font-mono tabular text-sm text-muted shrink-0">{formatINR(amount)}</span>
              </div>
              <div className="h-1.5 bg-line rounded-sm overflow-hidden">
                <div className="h-full rounded-sm bg-rust" style={{ width: `${(amount / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        {/* The folded row is a sum of many categories, not a category — a bar
            next to the real ones would invite comparing it to them. */}
        {tail && (
          <p className="flex justify-between items-baseline gap-3 mt-3 pt-3 border-t border-line text-sm text-muted">
            <span>{tail.count} smaller categories</span>
            <span className="font-mono tabular shrink-0">{formatINR(tail.total)}</span>
          </p>
        )}
        {summary.potCost > 0 && (
          <p className="text-xs text-muted mt-3">
            Includes {formatINR(summary.potCost)} from shared pots — your share, not the full payments.
          </p>
        )}
      </div>
    </div>
  );
}

// --- biggest payments -------------------------------------------------------

function BiggestPayments({ summary }: { summary: MonthSummary }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3 md:mb-4">
        <h2 className="font-display text-lg md:text-xl">Biggest payments</h2>
        {/* The list falls back to the largest few when a quiet month clears
            nothing, so the caption has to say which list you're looking at. */}
        <p className="text-xs text-muted shrink-0">
          {summary.topPayments.some((t) => Number(t.Amount) >= BIG_PAYMENT_FLOOR)
            ? `Over ${formatINR(BIG_PAYMENT_FLOOR)}`
            : "Largest this month"}
        </p>
      </div>
      <div className="border border-line rounded bg-paper divide-y divide-line">
        {summary.topPayments.map((tx) => (
          <PaymentRow key={tx.id} tx={tx} tone="out" />
        ))}
        {summary.topPayments.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">Nothing went out this month.</p>
        )}
      </div>
    </div>
  );
}

function PaymentRow({ tx, tone }: { tx: Transaction; tone: "in" | "out" }) {
  return (
    <div className="px-4 py-3 flex justify-between items-center gap-3">
      <div className="min-w-0">
        <p className="text-sm truncate" title={tx.FullDescription || tx.Description}>
          {tx.Description}
        </p>
        <p className="text-xs text-muted truncate">
          {formatDate(tx.Date)} · {tx.Account} · {tx.Category}
        </p>
      </div>
      <span className={`font-mono tabular text-sm shrink-0 ${tone === "out" ? "text-rust" : "text-forestDeep"}`}>
        {tone === "out" ? "-" : "+"}
        {formatINR(tx.Amount)}
      </span>
    </div>
  );
}

// --- account split ----------------------------------------------------------

function AccountSplitPanel({ summary }: { summary: MonthSummary }) {
  const widest = Math.max(...summary.accounts.map((a) => a.spent), 1);

  return (
    <div>
      <h2 className="font-display text-lg md:text-xl mb-3 md:mb-4">Split across your accounts</h2>
      <div className="border border-line rounded bg-paper p-4 md:p-5">
        <div className="space-y-4">
          {summary.accounts.map((a) => (
            <div key={a.account}>
              <div className="flex justify-between items-baseline gap-3">
                <span className="font-mono text-sm">{a.account}</span>
                <span className="font-mono tabular text-sm shrink-0">{formatINR(a.spent)}</span>
              </div>
              <div className="h-2 bg-line rounded-sm overflow-hidden mt-1.5">
                <div className="h-full rounded-sm bg-rust" style={{ width: `${(a.spent / widest) * 100}%` }} />
              </div>
              <p className="text-xs text-muted mt-1.5">
                {a.count} payments out · {formatINR(a.received)} in
              </p>
            </div>
          ))}
          {summary.accounts.length === 0 && <p className="text-sm text-muted">No accounts yet.</p>}
        </div>
        <p className="text-xs text-muted mt-4 pt-4 border-t border-line">
          {summary.selfTransferTotal > 0
            ? `Plus ${formatINR(summary.selfTransferTotal)} moved between your own accounts — excluded above.`
            : "Nothing moved between your own accounts this month."}
        </p>
      </div>
    </div>
  );
}

// --- money in that wasn't salary --------------------------------------------

function OtherMoneyIn({ summary }: { summary: MonthSummary }) {
  return (
    <div>
      <h2 className="font-display text-lg md:text-xl mb-3 md:mb-4">Money in that wasn&apos;t salary</h2>
      <div className="border border-line rounded bg-paper divide-y divide-line">
        {summary.otherInItems.map((tx) => (
          <PaymentRow key={tx.id} tx={tx} tone="in" />
        ))}
        {summary.otherInItems.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Nothing came in this month other than {summary.salary > 0 ? "salary" : "what's already counted"}.
          </p>
        )}
      </div>
      {summary.salary === 0 && (
        <p className="text-xs text-muted mt-2">
          No salary is recorded for {monthLabel(summary.month)} — check that the credit is categorised
          &ldquo;Income - Salary&rdquo;.
        </p>
      )}
    </div>
  );
}
