import { describe, expect, it } from 'vitest';

import type { Transaction } from '@/types/ledger';
import { planInstallmentSlices, summarizeInstallment } from '@/lib/ledger/installment';

/** Build an installment slice transaction for the summarize tests. */
function slice(p: Partial<Transaction> & { installmentSeq: number }): Transaction {
  return {
    id: `id-${p.installmentSeq}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: p.deleted ?? false,
    year: p.year ?? 2026,
    month: p.month ?? 7,
    day: p.day ?? 14,
    type: '지출',
    amount: p.amount ?? 0,
    note: '',
    installmentId: p.installmentId ?? 'inst-1',
    installmentSeq: p.installmentSeq,
    installmentCount: p.installmentCount ?? 3,
  };
}

describe('planInstallmentSlices', () => {
  it('splits an evenly-divisible total across consecutive months', () => {
    const slices = planInstallmentSlices(2026, 7, 200000, 2, 15);
    expect(slices).toEqual([
      { year: 2026, month: 7, day: 15, amount: 100000, seq: 1 },
      { year: 2026, month: 8, day: 15, amount: 100000, seq: 2 },
    ]);
  });

  it('puts the rounding remainder on the FIRST slice so slices sum to the exact total', () => {
    const slices = planInstallmentSlices(2026, 7, 100000, 3, null);
    expect(slices.map((s) => s.amount)).toEqual([33334, 33333, 33333]);
    expect(slices.reduce((sum, s) => sum + s.amount, 0)).toBe(100000);
  });

  it('rolls the month/year over past December', () => {
    const slices = planInstallmentSlices(2026, 12, 100000, 2, 10);
    expect(slices.map((s) => ({ year: s.year, month: s.month }))).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
  });

  it('rolls a longer installment across a full year boundary', () => {
    const slices = planInstallmentSlices(2026, 10, 600000, 6, null);
    expect(slices.map((s) => `${s.year}-${s.month}`)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-1',
      '2027-2',
      '2027-3',
    ]);
  });

  it('clamps the day to each month length and preserves a null day', () => {
    const slices = planInstallmentSlices(2026, 1, 100000, 2, 31);
    expect(slices.map((s) => s.day)).toEqual([31, 28]); // Jan 31 → Feb clamps to 28 (2026 not leap)
    expect(planInstallmentSlices(2026, 1, 100000, 2, null).map((s) => s.day)).toEqual([null, null]);
  });
});

describe('summarizeInstallment', () => {
  it('gathers total, count and the first month from slices scattered across buckets', () => {
    const records = {
      '2026-07': [slice({ installmentSeq: 1, month: 7, amount: 40000 })],
      '2026-08': [slice({ installmentSeq: 2, month: 8, amount: 40000 })],
      '2026-09': [slice({ installmentSeq: 3, month: 9, amount: 40000 })],
    };
    expect(summarizeInstallment(records, 'inst-1')).toEqual({
      total: 120000,
      count: 3,
      firstYear: 2026,
      firstMonth: 7,
    });
  });

  it('heals a mis-split installment: total is the SUM, so a re-split redistributes it evenly', () => {
    // The stale bug shape: whole amount on the first month, zeros after.
    const records = {
      '2026-07': [slice({ installmentSeq: 1, month: 7, amount: 120000 })],
      '2026-08': [slice({ installmentSeq: 2, month: 8, amount: 0 })],
      '2026-09': [slice({ installmentSeq: 3, month: 9, amount: 0 })],
    };
    const sum = summarizeInstallment(records, 'inst-1');
    expect(sum).toMatchObject({ total: 120000, count: 3, firstYear: 2026, firstMonth: 7 });
    const resplit = planInstallmentSlices(sum!.firstYear, sum!.firstMonth, sum!.total, sum!.count, 14);
    expect(resplit.map((s) => s.amount)).toEqual([40000, 40000, 40000]);
  });

  it('ignores deleted slices and returns null when nothing lives', () => {
    const records = {
      '2026-07': [slice({ installmentSeq: 1, amount: 40000, deleted: true })],
    };
    expect(summarizeInstallment(records, 'inst-1')).toBeNull();
  });
});
