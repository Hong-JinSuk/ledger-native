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
 * The fixed expenses IN EFFECT for a given month: ONLY the month's own captured snapshot. If the month
 * hasn't been set up (no snapshot), it has NO fixed expenses — the Settings template is never a
 * fallback. The template reaches a month only when the user explicitly applies defaults, which writes
 * that month's snapshot. This keeps each month independent (no global fixed expenses).
 */
export function monthFixedExpenses(settings: Settings, year: number, month: number): FixedExpense[] {
  const snapshot = settings.monthlyFixedExpenses?.[monthKey(year, month)];
  return (snapshot ?? []).filter((e) => !e.deleted);
}

/** Total fixed expenses in effect for a month (its own snapshot, or 0 if not set up). */
export function monthFixedTotal(settings: Settings, year: number, month: number): number {
  return monthFixedExpenses(settings, year, month).reduce((sum, e) => sum + (e.amount || 0), 0);
}

/**
 * True once a month has been set up (has a budget or its own fixed snapshot). Drives the month-entry
 * setup prompt: an un-configured month prompts on EVERY entry (until set up), so "나중에 하기" only
 * closes it for that visit — re-entering shows it again like the first time.
 */
export function isMonthConfigured(settings: Settings, year: number, month: number): boolean {
  const key = monthKey(year, month);
  return settings.monthlyBudgets?.[key] !== undefined || settings.monthlyFixedExpenses?.[key] !== undefined;
}
