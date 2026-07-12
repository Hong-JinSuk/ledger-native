import type { Settings, Transaction } from '@/types/ledger';
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
