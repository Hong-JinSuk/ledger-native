import { describe, expect, it } from 'vitest';

import {
  categoryTotals,
  countWeekdayWeekendDays,
  foldTopCategories,
  OTHER_SLICE_LABEL,
  periodDayRange,
  periodExpenseRows,
  sumAmount,
  weekdayTotals,
  weekendWeekdaySplit,
} from '@/lib/ledger/insights';
import type { Transaction } from '@/types/ledger';

// July 2026: the 1st is a Wednesday, so Sat/Sun fall on 4,5 · 11,12 · 18,19 · 25,26.
function mk(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? 'x',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: p.deleted ?? false,
    year: p.year ?? 2026,
    month: p.month ?? 7,
    day: p.day === undefined ? 1 : p.day, // preserve an explicit null
    type: p.type ?? '지출',
    category: p.category,
    merchant: p.merchant,
    amount: p.amount ?? 0,
    note: p.note ?? '',
  };
}

describe('periodExpenseRows', () => {
  const records: Record<string, Transaction[]> = {
    '2026-06': [mk({ id: 'jun', month: 6, amount: 600, category: '식비' })],
    '2026-07': [
      mk({ id: 'exp', amount: 1000, category: '식비' }),
      mk({ id: 'inc', amount: 5000, type: '수입', category: '급여' }),
      mk({ id: 'xfer', amount: 200, type: '이체', category: '이체' }),
      mk({ id: 'del', amount: 999, deleted: true, category: '식비' }),
      mk({ id: 'blank', amount: 0, type: '', category: undefined }),
    ],
  };

  it('keeps only active 지출 rows in the month', () => {
    const rows = periodExpenseRows(records, { kind: 'month', year: 2026, month: 7 });
    expect(rows.map((r) => r.id)).toEqual(['exp']); // income, transfer, deleted, blank all excluded
  });

  it('spans all twelve months for a year period', () => {
    const rows = periodExpenseRows(records, { kind: 'year', year: 2026 });
    expect(rows.map((r) => r.id).sort()).toEqual(['exp', 'jun']);
    expect(sumAmount(rows)).toBe(1600);
  });
});

describe('categoryTotals + foldTopCategories', () => {
  it('sums per category, largest first, dropping zero and grouping 미분류', () => {
    const rows = [
      mk({ amount: 3000, category: '식비' }),
      mk({ amount: 1000, category: '식비' }),
      mk({ amount: 2000, category: '교통' }),
      mk({ amount: 500, category: undefined }), // → 미분류
    ];
    expect(categoryTotals(rows)).toEqual([
      { name: '식비', amount: 4000 },
      { name: '교통', amount: 2000 },
      { name: '미분류', amount: 500 },
    ]);
  });

  it('folds the tail past N into 그 외 (never colliding with a real 기타)', () => {
    const slices = [
      { name: 'A', amount: 5000 },
      { name: 'B', amount: 4000 },
      { name: 'C', amount: 3000 },
      { name: 'D', amount: 2000 },
      { name: 'E', amount: 1000 },
      { name: 'F', amount: 900 },
      { name: '기타', amount: 800 },
      { name: 'H', amount: 700 },
    ];
    const folded = foldTopCategories(slices, 6);
    expect(folded).toHaveLength(7);
    expect(folded[6]).toEqual({ name: OTHER_SLICE_LABEL, amount: 1500 }); // 800 + 700
    expect(OTHER_SLICE_LABEL).not.toBe('기타');
  });

  it('leaves a short list untouched', () => {
    const slices = [{ name: 'A', amount: 5 }];
    expect(foldTopCategories(slices, 6)).toBe(slices);
  });
});

describe('weekdayTotals', () => {
  it('buckets expense by weekday (0=Sun..6=Sat), skipping undated rows', () => {
    const rows = [
      mk({ day: 6, amount: 1000 }), // Mon
      mk({ day: 8, amount: 2000 }), // Wed
      mk({ day: 4, amount: 3000 }), // Sat
      mk({ day: 5, amount: 500 }), // Sun
      mk({ day: null, amount: 9999 }), // undated → skipped
    ];
    const totals = weekdayTotals(rows);
    expect(totals[1]).toBe(1000); // Mon
    expect(totals[3]).toBe(2000); // Wed
    expect(totals[6]).toBe(3000); // Sat
    expect(totals[0]).toBe(500); // Sun
    expect(totals[2]).toBe(0);
  });
});

describe('countWeekdayWeekendDays', () => {
  it('counts weekday vs weekend calendar days inclusively', () => {
    // Jul 1 (Wed) → Jul 7 (Tue) 2026: weekend = Jul 4, 5.
    const r = countWeekdayWeekendDays(new Date(2026, 6, 1), new Date(2026, 6, 7));
    expect(r).toEqual({ weekdayDays: 5, weekendDays: 2 });
  });
});

describe('periodDayRange', () => {
  it('ends a current (partial) month at today', () => {
    const range = periodDayRange({ kind: 'month', year: 2026, month: 7 }, new Date(2026, 6, 15));
    expect(range?.start).toEqual(new Date(2026, 6, 1));
    expect(range?.end).toEqual(new Date(2026, 6, 15));
  });

  it('ends a completed past month on its last day', () => {
    const range = periodDayRange({ kind: 'month', year: 2026, month: 6 }, new Date(2026, 6, 15));
    expect(range?.end).toEqual(new Date(2026, 5, 30));
  });

  it('returns null before the period has started', () => {
    expect(periodDayRange({ kind: 'year', year: 2027 }, new Date(2026, 6, 15))).toBeNull();
  });
});

describe('weekendWeekdaySplit', () => {
  it('compares by daily average over the elapsed range', () => {
    const rows = [
      mk({ day: 6, amount: 1000 }), // Mon (weekday)
      mk({ day: 8, amount: 2000 }), // Wed (weekday)
      mk({ day: 4, amount: 3000 }), // Sat (weekend)
      mk({ day: 5, amount: 500 }), // Sun (weekend)
      mk({ day: null, amount: 9999 }), // undated → skipped
    ];
    // Jul 1–15 2026 → weekdays 11, weekend days 4 (Sat/Sun 4,5,11,12).
    const range = { start: new Date(2026, 6, 1), end: new Date(2026, 6, 15) };
    const split = weekendWeekdaySplit(rows, range);
    expect(split.weekdayTotal).toBe(3000);
    expect(split.weekendTotal).toBe(3500);
    expect(split.weekdayDays).toBe(11);
    expect(split.weekendDays).toBe(4);
    expect(split.weekdayAvg).toBe(273); // round(3000 / 11)
    expect(split.weekendAvg).toBe(875); // 3500 / 4
  });

  it('yields zero averages with no range', () => {
    const split = weekendWeekdaySplit([mk({ day: 4, amount: 3000 })], null);
    expect(split.weekendTotal).toBe(3000);
    expect(split.weekendAvg).toBe(0);
    expect(split.weekdayAvg).toBe(0);
  });
});
