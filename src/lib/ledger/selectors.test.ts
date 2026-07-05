import { describe, expect, it } from 'vitest';

import type { Settings, Transaction } from '@/types/ledger';
import {
  activeRows,
  groupByDay,
  monthRemainingBudget,
  monthSummary,
  searchRows,
  sortRowsByDayDesc,
  totalExpense,
  totalIncome,
} from '@/lib/ledger/selectors';

function mk(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? 'x',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: p.deleted ?? false,
    year: p.year ?? 2026,
    month: p.month ?? 7,
    day: p.day === undefined ? 1 : p.day, // preserve an explicit null (don't fall through to 1)
    type: p.type ?? '지출',
    category: p.category,
    merchant: p.merchant,
    amount: p.amount ?? 0,
    note: p.note ?? '',
  };
}

function settings(over: Partial<Settings> = {}): Settings {
  return {
    budget: 0,
    monthlyBudgets: {},
    currency: '원',
    fixedExpenseTypes: [],
    fixedExpenses: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('selectors', () => {
  it('activeRows drops soft-deleted and fully-blank rows', () => {
    const rows = [
      mk({ id: 'a', type: '지출', amount: 1000 }),
      mk({ id: 'b', deleted: true, type: '지출', amount: 5000 }),
      mk({ id: 'c', type: '', amount: 0, note: '', merchant: '', category: '' }),
    ];
    expect(activeRows(rows).map((r) => r.id)).toEqual(['a']);
  });

  it('totals exclude 이체 (transfer) from income and expense', () => {
    const rows = [
      mk({ type: '수입', amount: 1000 }),
      mk({ type: '지출', amount: 400 }),
      mk({ type: '이체', amount: 9999 }),
    ];
    expect(totalIncome(rows)).toBe(1000);
    expect(totalExpense(rows)).toBe(400);
    expect(monthSummary(rows).balance).toBe(600);
  });

  it('monthRemainingBudget = budget − fixed − expense + income, or null when unset', () => {
    const s = settings({
      monthlyBudgets: { '2026-07': 100000 },
      fixedExpenses: [{ id: 'f', type: 'x', title: 't', amount: 20000, date: null, note: '' }],
    });
    const rows = [mk({ type: '지출', amount: 30000 }), mk({ type: '수입', amount: 5000 })];
    expect(monthRemainingBudget(rows, s, 2026, 7)).toBe(55000);
    expect(monthRemainingBudget(rows, settings(), 2026, 7)).toBeNull();
  });

  it('groupByDay buckets by day (null → 0)', () => {
    const g = groupByDay([
      mk({ id: 'a', day: 3 }),
      mk({ id: 'b', day: 3 }),
      mk({ id: 'c', day: 1 }),
      mk({ id: 'd', day: null }),
    ]);
    expect(g[3].map((r) => r.id)).toEqual(['a', 'b']);
    expect(g[1].map((r) => r.id)).toEqual(['c']);
    expect(g[0].map((r) => r.id)).toEqual(['d']);
  });

  it('sortRowsByDayDesc sorts by day desc, tie-broken by id', () => {
    const rows = [mk({ id: 'x', day: 1 }), mk({ id: 'b', day: 3 }), mk({ id: 'a', day: 3 })];
    expect(sortRowsByDayDesc(rows).map((r) => r.id)).toEqual(['a', 'b', 'x']);
  });

  it('searchRows matches merchant / category / note case-insensitively', () => {
    const rows = [mk({ merchant: '스타벅스' }), mk({ note: '커피' }), mk({ category: '식비' })];
    expect(searchRows(rows, '커피')).toHaveLength(1);
    expect(searchRows(rows, '스타')).toHaveLength(1);
    expect(searchRows(rows, '')).toHaveLength(3);
  });
});
