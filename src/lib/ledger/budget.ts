import type { FixedExpense, Settings } from '@/types/ledger';
import { monthKey } from '@/lib/date';

/** Budget set for a specific month (0 if none). */
export function getMonthlyBudget(settings: Settings, year: number, month: number): number {
  return settings.monthlyBudgets?.[monthKey(year, month)] ?? 0;
}

/** Sum of all explicitly-set monthly budgets in a year. */
export function getYearlyBudget(settings: Settings, year: number): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    const v = settings.monthlyBudgets?.[monthKey(year, m)];
    if (v !== undefined) total += v;
  }
  return total;
}

/**
 * The fixed expenses IN EFFECT for a given month: the month's frozen snapshot if it has one (set when
 * its budget was first saved), otherwise the live template. This is what makes past months immutable —
 * a frozen month reads its own captured list, so editing the template later can't change it.
 */
export function monthFixedExpenses(settings: Settings, year: number, month: number): FixedExpense[] {
  const snapshot = settings.monthlyFixedExpenses?.[monthKey(year, month)];
  const list = snapshot ?? settings.fixedExpenses;
  return list.filter((e) => !e.deleted);
}

/** Total fixed expenses in effect for a month (frozen snapshot if any, else the live template). */
export function monthFixedTotal(settings: Settings, year: number, month: number): number {
  return monthFixedExpenses(settings, year, month).reduce((sum, e) => sum + (e.amount || 0), 0);
}
