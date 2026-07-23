/**
 * Insights aggregations — pure selectors over the ledger, powering the Insights tab's spending charts.
 * All "소비"(spending) here means 지출(expense) only (수입/이체 excluded). Kept out of the screen so the
 * math is unit-tested and every chart reads the same numbers. Amounts are integer KRW (never floats).
 *
 * ⚠️ Weekday math uses LOCAL `new Date(year, month-1, day)` — the same convention as `lib/date`'s
 * weekday helpers — so a row's weekday matches what the calendar shows. Undated rows (`day == null`)
 * can't be placed on a weekday and are skipped by the weekday/weekend selectors (they still count in
 * category totals).
 */

import { daysInMonth, monthKey } from '@/lib/date';
import { activeRows } from '@/lib/ledger/selectors';
import type { Transaction } from '@/types/ledger';

/** The period an Insights view aggregates: a single month, or a whole year. */
export type InsightPeriod =
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number };

/** Active 지출(expense) rows in the period — one month bucket, or all twelve of a year. */
export function periodExpenseRows(
  records: Record<string, Transaction[]>,
  period: InsightPeriod,
): Transaction[] {
  const keys =
    period.kind === 'month'
      ? [monthKey(period.year, period.month)]
      : Array.from({ length: 12 }, (_, i) => monthKey(period.year, i + 1));
  const out: Transaction[] = [];
  for (const key of keys) {
    for (const row of activeRows(records[key])) {
      if (row.type === '지출') out.push(row);
    }
  }
  return out;
}

/** Sum of a set of rows' amounts (integer KRW). */
export function sumAmount(rows: Transaction[]): number {
  return rows.reduce((total, r) => total + (Number(r.amount) || 0), 0);
}

export interface CategorySlice {
  name: string;
  amount: number;
}

/** Per-category expense totals, largest first (ties broken by name so order is stable). Zero-sum
 *  categories are dropped. Rows without a category are grouped under '미분류'. */
export function categoryTotals(rows: Transaction[]): CategorySlice[] {
  const byName = new Map<string, number>();
  for (const r of rows) {
    const name = r.category || '미분류';
    byName.set(name, (byName.get(name) ?? 0) + (Number(r.amount) || 0));
  }
  return [...byName.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .filter((slice) => slice.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

/**
 * Fold-bucket label for categories past the top-N. Deliberately '그 외', NOT '기타' — the seed data ships
 * a real "기타" category, so reusing it would put two "기타" rows in the same legend.
 */
export const OTHER_SLICE_LABEL = '그 외';

/** Keep the top `n` slices; sum the remaining tail into one '그 외' slice appended at the end. */
export function foldTopCategories(slices: CategorySlice[], n: number): CategorySlice[] {
  if (slices.length <= n) return slices;
  const head = slices.slice(0, n);
  const rest = slices.slice(n).reduce((total, s) => total + s.amount, 0);
  return rest > 0 ? [...head, { name: OTHER_SLICE_LABEL, amount: rest }] : head;
}

/** Expense summed by weekday, indexed 0=Sun … 6=Sat (JS `getDay`). Undated rows are skipped. */
export function weekdayTotals(rows: Transaction[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    if (r.day == null) continue;
    const dow = new Date(r.year, r.month - 1, r.day).getDay();
    out[dow] += Number(r.amount) || 0;
  }
  return out;
}

export interface WeekendWeekdaySplit {
  weekdayTotal: number;
  weekendTotal: number;
  /** Elapsed calendar day counts of each kind in the period — the daily-average denominators. */
  weekdayDays: number;
  weekendDays: number;
  /** total ÷ days, rounded to integer KRW; 0 when that kind has no elapsed days yet. */
  weekdayAvg: number;
  weekendAvg: number;
}

/**
 * Inclusive calendar range [start, end] of the ELAPSED part of the period, or null if it hasn't begun.
 * For the current month/year this ends at `now` (a partial period), so daily averages divide by the
 * days actually elapsed — not a full month/year that hasn't happened. A past period ends on its own
 * last day.
 */
export function periodDayRange(period: InsightPeriod, now: Date): { start: Date; end: Date } | null {
  const start =
    period.kind === 'month'
      ? new Date(period.year, period.month - 1, 1)
      : new Date(period.year, 0, 1);
  const last =
    period.kind === 'month'
      ? new Date(period.year, period.month - 1, daysInMonth(period.year, period.month))
      : new Date(period.year, 11, 31);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < start) return null;
  return { start, end: today < last ? today : last };
}

/** Count weekday vs weekend calendar days in an inclusive [start, end] range. */
export function countWeekdayWeekendDays(
  start: Date,
  end: Date,
): { weekdayDays: number; weekendDays: number } {
  let weekdayDays = 0;
  let weekendDays = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) weekendDays += 1;
    else weekdayDays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { weekdayDays, weekendDays };
}

/**
 * Weekend vs weekday expense compared by DAILY AVERAGE (total ÷ elapsed days of that kind). Comparing
 * raw totals would be unfair — weekdays outnumber weekend days 5:2, so they'd look bigger by
 * construction. `range` supplies the denominators (see {@link periodDayRange}); null → averages are 0.
 */
export function weekendWeekdaySplit(
  rows: Transaction[],
  range: { start: Date; end: Date } | null,
): WeekendWeekdaySplit {
  let weekdayTotal = 0;
  let weekendTotal = 0;
  for (const r of rows) {
    if (r.day == null) continue;
    const dow = new Date(r.year, r.month - 1, r.day).getDay();
    const amount = Number(r.amount) || 0;
    if (dow === 0 || dow === 6) weekendTotal += amount;
    else weekdayTotal += amount;
  }
  const { weekdayDays, weekendDays } = range
    ? countWeekdayWeekendDays(range.start, range.end)
    : { weekdayDays: 0, weekendDays: 0 };
  return {
    weekdayTotal,
    weekendTotal,
    weekdayDays,
    weekendDays,
    weekdayAvg: weekdayDays > 0 ? Math.round(weekdayTotal / weekdayDays) : 0,
    weekendAvg: weekendDays > 0 ? Math.round(weekendTotal / weekendDays) : 0,
  };
}
