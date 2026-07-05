import type { Settings } from '@/types/ledger';
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

/** Total of all recurring fixed expenses. */
export function fixedExpensesTotal(settings: Settings): number {
  return settings.fixedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
}

/** How many months in a year have an explicit budget set (used to scale yearly fixed costs). */
export function configuredMonthsCount(settings: Settings, year: number): number {
  let count = 0;
  for (let m = 1; m <= 12; m++) {
    if (settings.monthlyBudgets?.[monthKey(year, m)] !== undefined) count++;
  }
  return count;
}
