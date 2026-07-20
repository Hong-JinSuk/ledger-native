import { describe, expect, it } from 'vitest';

import type { FixedExpense, Settings, Transaction } from '@/types/ledger';
import { isMonthConfigured } from '@/lib/ledger/budget';
import {
  activeRows,
  categoryUsage,
  groupByDay,
  isFreshLedger,
  monthRemainingBudget,
  monthSummary,
  orderByUsage,
  orderCategories,
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
    installmentSeq: p.installmentSeq,
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

function fe(id: string, amount: number): FixedExpense {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    type: 'x',
    title: id,
    amount,
    date: null,
    note: '',
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
    // Fixed expenses come from THIS month's snapshot (per-month), not a global template.
    const s = settings({
      monthlyBudgets: { '2026-07': 100000 },
      monthlyFixedExpenses: { '2026-07': [fe('f', 20000)] },
    });
    const rows = [mk({ type: '지출', amount: 30000 }), mk({ type: '수입', amount: 5000 })];
    expect(monthRemainingBudget(rows, s, 2026, 7)).toBe(55000);
    expect(monthRemainingBudget(rows, settings(), 2026, 7)).toBeNull();
  });

  it('a frozen month reads its snapshot, so editing the template cannot move its remaining budget', () => {
    // July frozen at 20,000; the live template is now 99,000 — July must ignore the template.
    const s = settings({
      monthlyBudgets: { '2026-07': 100000 },
      fixedExpenses: [fe('live', 99000)],
      monthlyFixedExpenses: { '2026-07': [fe('snap', 20000)] },
    });
    const rows = [mk({ type: '지출', amount: 30000 })];
    expect(monthRemainingBudget(rows, s, 2026, 7)).toBe(50000); // 100000 − 20000(snapshot) − 30000
  });

  it('a month with no snapshot has ZERO fixed expenses — the Settings template is never a fallback', () => {
    const s = settings({
      monthlyBudgets: { '2026-08': 100000 },
      fixedExpenses: [fe('live', 15000)], // default template must NOT leak into August
    });
    const rows = [mk({ type: '지출', amount: 10000 })];
    expect(monthRemainingBudget(rows, s, 2026, 8)).toBe(90000); // 100000 − 0 − 10000
  });

  it('isMonthConfigured reflects whether a month has been set up (budget or fixed snapshot)', () => {
    expect(isMonthConfigured(settings(), 2026, 7)).toBe(false);
    expect(isMonthConfigured(settings({ monthlyBudgets: { '2026-07': 100000 } }), 2026, 7)).toBe(true);
    expect(isMonthConfigured(settings({ monthlyFixedExpenses: { '2026-07': [] } }), 2026, 7)).toBe(true);
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

describe('categoryUsage', () => {
  const NOW = { year: 2026, month: 7 }; // recent window = 2026-05, 06, 07

  it('splits per-type category counts into recent-window vs all-time', () => {
    const records = {
      '2026-07': [
        mk({ id: 'a', type: '지출', category: '식비' }),
        mk({ id: 'b', type: '지출', category: '식비' }),
        mk({ id: 'c', type: '지출', category: '교통' }),
        mk({ id: 'd', type: '수입', category: '급여' }),
      ],
      '2026-05': [mk({ id: 'e', type: '지출', category: '식비' })], // recent
      '2026-02': [
        mk({ id: 'f', type: '지출', category: '교통' }),
        mk({ id: 'g', type: '지출', category: '교통' }),
      ], // old → total only
      '2026-08': [mk({ id: 'h', type: '지출', category: '식비' })], // future → total only
    };
    const usage = categoryUsage(records, NOW);
    expect(usage['지출']['식비']).toEqual({ recent: 3, total: 4 }); // 07×2 + 05×1 recent; +08×1 total
    expect(usage['지출']['교통']).toEqual({ recent: 1, total: 3 }); // 07×1 recent; +02×2 total
    expect(usage['수입']).toEqual({ 급여: { recent: 1, total: 1 } });
    expect(usage['이체']).toEqual({});
  });

  it('ignores soft-deleted rows and rows with no type/category', () => {
    const records = {
      '2026-07': [
        mk({ id: 'a', type: '지출', category: '식비' }),
        mk({ id: 'b', type: '지출', category: '식비', deleted: true }),
        mk({ id: 'c', type: '', category: '식비' }),
        mk({ id: 'd', type: '지출', category: undefined }),
      ],
    };
    expect(categoryUsage(records, NOW)['지출']).toEqual({ 식비: { recent: 1, total: 1 } });
  });

  it('counts an installment once (first slice only), not once per month', () => {
    const records = {
      '2026-07': [mk({ id: 'i1', type: '지출', category: '쇼핑', installmentSeq: 1 })],
      '2026-08': [mk({ id: 'i2', type: '지출', category: '쇼핑', installmentSeq: 2 })],
      '2026-09': [mk({ id: 'i3', type: '지출', category: '쇼핑', installmentSeq: 3 })],
    };
    expect(categoryUsage(records, NOW)['지출']).toEqual({ 쇼핑: { recent: 1, total: 1 } });
  });
});

describe('orderByUsage', () => {
  const cats = (names: string[]) => names.map((name) => ({ name }));

  it('sorts by recent count first — a lately-used category beats an old high-total one', () => {
    const usage = {
      배달: { recent: 30, total: 45 },
      식비: { recent: 18, total: 300 },
      교통: { recent: 3, total: 210 },
    };
    expect(orderByUsage(cats(['식비', '교통', '배달']), usage).map((c) => c.name)).toEqual([
      '배달',
      '식비',
      '교통',
    ]);
  });

  it('breaks a recent tie by all-time, then keeps input (seed) order when both tie', () => {
    const usage = {
      식비: { recent: 0, total: 50 },
      교통: { recent: 0, total: 90 },
      // 쇼핑·뷰티: no usage → 0/0, stay in input order after the used ones
    };
    expect(orderByUsage(cats(['식비', '교통', '쇼핑', '뷰티']), usage).map((c) => c.name)).toEqual([
      '교통',
      '식비',
      '쇼핑',
      '뷰티',
    ]);
  });

  it('leaves categories with no usage in their original order', () => {
    expect(orderByUsage(cats(['a', 'b', 'c']), {}).map((c) => c.name)).toEqual(['a', 'b', 'c']);
  });
});

describe('orderCategories (manual order vs usage fallback)', () => {
  it('falls back to usage order when nothing is manually arranged', () => {
    const usage = { 배달: { recent: 30, total: 45 }, 식비: { recent: 18, total: 300 } };
    const items = [{ name: '식비' }, { name: '배달' }, { name: '교통' }];
    expect(orderCategories(items, usage).map((c) => c.name)).toEqual(['배달', '식비', '교통']);
  });

  it('uses the manual order (ascending) once any category has one; usage is ignored', () => {
    const usage = { 배달: { recent: 99, total: 99 } }; // would top usage, but manual order wins
    const items = [
      { name: '배달', order: 2 },
      { name: '식비', order: 0 },
      { name: '교통', order: 1 },
    ];
    expect(orderCategories(items, usage).map((c) => c.name)).toEqual(['식비', '교통', '배달']);
  });

  it('sorts a category added after arranging (no order) to the end', () => {
    const items = [{ name: '식비', order: 0 }, { name: '교통', order: 1 }, { name: '새거' }];
    expect(orderCategories(items, {}).map((c) => c.name)).toEqual(['식비', '교통', '새거']);
  });
});

describe('isFreshLedger (first-run onboarding gate)', () => {
  it('true when no budget, no fixed expenses, and no live records', () => {
    expect(isFreshLedger(settings(), {})).toBe(true);
    expect(isFreshLedger(settings(), { '2026-07': [] })).toBe(true);
    // A tombstoned-only month still counts as fresh (nothing live).
    expect(isFreshLedger(settings(), { '2026-07': [mk({ deleted: true, amount: 1000 })] })).toBe(true);
  });

  it('false once a default budget is set', () => {
    expect(isFreshLedger(settings({ budget: 100000 }), {})).toBe(false);
  });

  it('false when a live fixed expense exists — but tombstoned-only stays fresh', () => {
    expect(isFreshLedger(settings({ fixedExpenses: [fe('a', 5000)] }), {})).toBe(false);
    expect(isFreshLedger(settings({ fixedExpenses: [{ ...fe('a', 5000), deleted: true }] }), {})).toBe(true);
  });

  it('false when any live record exists', () => {
    expect(isFreshLedger(settings(), { '2026-07': [mk({ amount: 1000 })] })).toBe(false);
  });
});
