import type { Settings, Transaction, TransactionType } from '@/types/ledger';
import { monthKey } from '@/lib/date';
import { getMonthlyBudget, getYearlyBudget, monthFixedTotal } from '@/lib/ledger/budget';

export interface PeriodSummary {
  income: number;
  expense: number;
  /** income − expense (이체/transfer is excluded from both). */
  balance: number;
}

/** Rows actually shown: not soft-deleted and not entirely blank. */
export function activeRows(rows: Transaction[] | undefined): Transaction[] {
  if (!rows) return [];
  return rows.filter(
    (r) => !r.deleted && !!(r.type || r.category || r.merchant || Number(r.amount) || r.note),
  );
}

export function totalIncome(rows: Transaction[]): number {
  return rows.filter((r) => r.type === '수입').reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

export function totalExpense(rows: Transaction[]): number {
  return rows.filter((r) => r.type === '지출').reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

/** Net for a set of rows: income − expense. */
export function netTotal(rows: Transaction[]): number {
  return totalIncome(rows) - totalExpense(rows);
}

export function monthSummary(rows: Transaction[] | undefined): PeriodSummary {
  const active = activeRows(rows);
  const income = totalIncome(active);
  const expense = totalExpense(active);
  return { income, expense, balance: income - expense };
}

export function yearSummary(
  records: Record<string, Transaction[]>,
  year: number,
): PeriodSummary {
  let income = 0;
  let expense = 0;
  for (let m = 1; m <= 12; m++) {
    const s = monthSummary(records[monthKey(year, m)]);
    income += s.income;
    expense += s.expense;
  }
  return { income, expense, balance: income - expense };
}

/**
 * Remaining budget for a month, or null when no budget is set.
 * Formula ported from the web (used identically in 4 screens):
 *   budget − fixedExpenses − expense + income
 * Fixed expenses are the month's frozen snapshot (if budgeted) so past months never drift.
 */
export function monthRemainingBudget(
  rows: Transaction[] | undefined,
  settings: Settings,
  year: number,
  month: number,
): number | null {
  const budget = getMonthlyBudget(settings, year, month);
  if (budget <= 0) return null;
  const s = monthSummary(rows);
  return budget - monthFixedTotal(settings, year, month) - s.expense + s.income;
}

/** Remaining budget for a whole year: each configured month contributes its OWN frozen fixed total. */
export function yearRemainingBudget(
  records: Record<string, Transaction[]>,
  settings: Settings,
  year: number,
): number | null {
  const yearlyBudget = getYearlyBudget(settings, year);
  if (yearlyBudget <= 0) return null;
  const s = yearSummary(records, year);
  let yearlyFixed = 0;
  for (let m = 1; m <= 12; m++) {
    if (settings.monthlyBudgets?.[monthKey(year, m)] !== undefined) {
      yearlyFixed += monthFixedTotal(settings, year, m);
    }
  }
  return yearlyBudget - yearlyFixed - s.expense + s.income;
}

/** Group rows by day (null day → bucket 0). */
export function groupByDay(rows: Transaction[]): Record<number, Transaction[]> {
  const out: Record<number, Transaction[]> = {};
  for (const r of rows) {
    const day = r.day ?? 0;
    (out[day] ??= []).push(r);
  }
  return out;
}

/** Sort by day descending, breaking ties by id for stable ordering (web behaviour). */
export function sortRowsByDayDesc(rows: Transaction[]): Transaction[] {
  return [...rows].sort((a, b) => {
    const dayDiff = (b.day ?? 0) - (a.day ?? 0);
    return dayDiff !== 0 ? dayDiff : a.id.localeCompare(b.id);
  });
}

/** How many calendar months (including the current one) count as "recent" for category ordering. */
export const RECENT_USAGE_MONTHS = 3;

/** Per-category usage split into a recent window vs all-time — the two keys the drawer sorts by. */
export interface CategoryUsageStat {
  /** Uses within the last {@link RECENT_USAGE_MONTHS} calendar months (incl. the current month). */
  recent: number;
  /** Uses across all history — the tiebreak when recent counts are equal. */
  total: number;
}

/** The `YYYY-MM` keys for the recent window ending at (and including) `year`-`month`. */
function recentMonthKeys(year: number, month: number, count: number): Set<string> {
  const keys = new Set<string>();
  let y = year;
  let m = month;
  for (let i = 0; i < count; i += 1) {
    keys.add(monthKey(y, m));
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return keys;
}

/**
 * Per-type, per-category usage from the user's own history — powers the record drawer's "most-used
 * first" order. Each category gets a {@link CategoryUsageStat}: `recent` (uses in the last
 * {@link RECENT_USAGE_MONTHS} months, so shifting habits float up) and `total` (all-time, the
 * tiebreak). `now` is the reference month for the recent window. An installment (할부) counts once
 * (its first slice) so one N-month purchase doesn't outweigh N separate buys.
 */
export function categoryUsage(
  records: Record<string, Transaction[]>,
  now: { year: number; month: number },
): Record<TransactionType, Record<string, CategoryUsageStat>> {
  const recentKeys = recentMonthKeys(now.year, now.month, RECENT_USAGE_MONTHS);
  const usage: Record<TransactionType, Record<string, CategoryUsageStat>> = {
    수입: {},
    지출: {},
    이체: {},
  };
  for (const [key, rows] of Object.entries(records)) {
    const isRecent = recentKeys.has(key);
    for (const r of rows) {
      if (r.deleted || !r.type || !r.category) continue;
      if (r.installmentSeq && r.installmentSeq > 1) continue; // an installment counts once (first slice)
      const bucket = usage[r.type];
      const stat = (bucket[r.category] ??= { recent: 0, total: 0 });
      stat.total += 1;
      if (isRecent) stat.recent += 1;
    }
  }
  return usage;
}

/**
 * Order categories most-used-first: recent-window count, then all-time count, then the input order
 * (stable) so ties keep the seed order and unused categories stay put at the end. Pure — the drawer
 * feeds it the already-filtered list for the selected type.
 */
export function orderByUsage<T extends { name: string }>(
  items: T[],
  usage: Record<string, CategoryUsageStat>,
): T[] {
  return [...items].sort((a, b) => {
    const sa = usage[a.name];
    const sb = usage[b.name];
    const recentDiff = (sb?.recent ?? 0) - (sa?.recent ?? 0);
    if (recentDiff !== 0) return recentDiff;
    return (sb?.total ?? 0) - (sa?.total ?? 0);
  });
}

/**
 * True when the ledger looks brand-new — no default budget, no (live) fixed expenses, no (live) records.
 * Drives the first-run welcome (combined with a settled first sync + the local "seen" flag). Short-circuits
 * on budget so an existing user never pays the full record scan.
 */
export function isFreshLedger(settings: Settings, records: Record<string, Transaction[]>): boolean {
  if (settings.budget !== 0) return false;
  if (settings.fixedExpenses.some((e) => !e.deleted)) return false;
  for (const rows of Object.values(records)) {
    if (rows.some((r) => !r.deleted)) return false;
  }
  return true;
}

/** Case-insensitive substring search over merchant / category / note. */
export function searchRows(rows: Transaction[], query: string): Transaction[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      (r.merchant ?? '').toLowerCase().includes(q) ||
      (r.category ?? '').toLowerCase().includes(q) ||
      (r.note ?? '').toLowerCase().includes(q),
  );
}
