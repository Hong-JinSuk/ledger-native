import { describe, expect, it } from 'vitest';

import type { Transaction } from '@/types/ledger';
import {
  installmentTotals,
  planInstallmentPayoff,
  planInstallmentSlices,
  summarizeInstallment,
} from '@/lib/ledger/installment';

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
    installmentApr: p.installmentApr,
    installmentPrincipal: p.installmentPrincipal,
  };
}

describe('planInstallmentSlices', () => {
  it('splits an evenly-divisible total across consecutive months', () => {
    const slices = planInstallmentSlices(2026, 7, 200000, 2, 15);
    expect(slices).toEqual([
      { year: 2026, month: 7, day: 15, principal: 100000, interest: 0, amount: 100000, seq: 1 },
      { year: 2026, month: 8, day: 15, principal: 100000, interest: 0, amount: 100000, seq: 2 },
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

  it('charges interest on the declining balance (원금균등) so monthly charges shrink', () => {
    // 1,200,000원 · 12개월 · 연 10% → 원금 100,000/월, 이자는 잔액 기준으로 매달 감소.
    const slices = planInstallmentSlices(2026, 7, 1200000, 12, 14, 10);
    expect(slices.every((s) => s.principal === 100000)).toBe(true);
    expect(slices[0].interest).toBe(10000); // 1,200,000 × 10%/12
    expect(slices[0].amount).toBe(110000);
    expect(slices[11].interest).toBe(833); // 100,000 × 10%/12 ≈ 833
    expect(slices[11].amount).toBe(100833);
    // Every month's charge is ≤ the previous one (interest only ever falls).
    for (let i = 1; i < slices.length; i += 1) {
      expect(slices[i].amount).toBeLessThanOrEqual(slices[i - 1].amount);
    }
    // Closed form: total interest = 원금 × rate × (N+1)/24 = 1,200,000 × 0.1 × 13/24 = 65,000.
    expect(installmentTotals(slices).interest).toBe(65000);
    expect(installmentTotals(slices).principal).toBe(1200000);
  });

  it('keeps the principal split independent of interest (principals still sum to the total)', () => {
    const slices = planInstallmentSlices(2026, 7, 100000, 3, null, 15);
    expect(slices.map((s) => s.principal)).toEqual([33334, 33333, 33333]);
    expect(slices.reduce((sum, s) => sum + s.principal, 0)).toBe(100000);
    expect(slices.every((s) => s.interest > 0)).toBe(true);
  });

  it('treats a non-positive rate as 무이자 (interest all zero)', () => {
    const slices = planInstallmentSlices(2026, 7, 120000, 3, null, 0);
    expect(slices.every((s) => s.interest === 0 && s.amount === s.principal)).toBe(true);
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
      principal: 120000,
      count: 3,
      apr: 0,
      firstYear: 2026,
      firstMonth: 7,
    });
  });

  it('recovers principal from installmentPrincipal (not amount) and reads the rate', () => {
    // Interest-bearing installment: amount folds in interest, so principal must come from the stored field.
    const records = {
      '2026-07': [
        slice({ installmentSeq: 1, month: 7, amount: 110000, installmentPrincipal: 100000, installmentApr: 10 }),
      ],
      '2026-08': [
        slice({ installmentSeq: 2, month: 8, amount: 109167, installmentPrincipal: 100000, installmentApr: 10 }),
      ],
    };
    expect(summarizeInstallment(records, 'inst-1')).toMatchObject({ principal: 200000, apr: 10 });
  });

  it('heals a mis-split installment: total is the SUM, so a re-split redistributes it evenly', () => {
    // The stale bug shape: whole amount on the first month, zeros after.
    const records = {
      '2026-07': [slice({ installmentSeq: 1, month: 7, amount: 120000 })],
      '2026-08': [slice({ installmentSeq: 2, month: 8, amount: 0 })],
      '2026-09': [slice({ installmentSeq: 3, month: 9, amount: 0 })],
    };
    const sum = summarizeInstallment(records, 'inst-1');
    expect(sum).toMatchObject({ principal: 120000, count: 3, firstYear: 2026, firstMonth: 7 });
    const resplit = planInstallmentSlices(sum!.firstYear, sum!.firstMonth, sum!.principal, sum!.count, 14);
    expect(resplit.map((s) => s.amount)).toEqual([40000, 40000, 40000]);
  });

  it('ignores deleted slices and returns null when nothing lives', () => {
    const records = {
      '2026-07': [slice({ installmentSeq: 1, amount: 40000, deleted: true })],
    };
    expect(summarizeInstallment(records, 'inst-1')).toBeNull();
  });
});

/** Build a full installment (one slice per month bucket) the way the store stores it, for payoff tests. */
function makeInstallment(total: number, count: number, apr: number): Record<string, Transaction[]> {
  const records: Record<string, Transaction[]> = {};
  for (const sl of planInstallmentSlices(2026, 7, total, count, 14, apr)) {
    const key = `${sl.year}-${String(sl.month).padStart(2, '0')}`;
    records[key] = [
      slice({
        installmentSeq: sl.seq,
        year: sl.year,
        month: sl.month,
        amount: sl.amount,
        installmentCount: count,
        installmentApr: apr > 0 ? apr : undefined,
        installmentPrincipal: apr > 0 ? sl.principal : undefined,
      }),
    ];
  }
  return records;
}

describe('planInstallmentPayoff', () => {
  it('settles a 무이자 installment in the chosen month: remaining principal lumps there, later months drop', () => {
    const records = makeInstallment(1200000, 12, 0); // 원금 120만 · 12개월 · 매달 10만
    const plan = planInstallmentPayoff(records, 'inst-1', 2026, 9); // 9월 = seq 3
    expect(plan).toEqual({
      payoffSeq: 3,
      count: 3,
      payoffAmount: 1000000, // 남은 원금 10만 × 10개월
      payoffPrincipal: 1000000,
      apr: 0,
      removedCount: 9, // seq 4..12
    });
  });

  it('waives future interest but keeps the payoff month\'s interest', () => {
    const records = makeInstallment(1200000, 12, 10);
    const plan = planInstallmentPayoff(records, 'inst-1', 2026, 9);
    // 남은 원금 1,000,000 + 9월(seq3) 이자 8,333 = 1,008,333. 미래 이자(37,500)는 면제.
    expect(plan).toMatchObject({
      payoffSeq: 3,
      count: 3,
      payoffAmount: 1008333,
      payoffPrincipal: 1000000,
      apr: 10,
      removedCount: 9,
    });
  });

  it('keeps the kept principals summing to the original 원금 (edit stays sound)', () => {
    const records = makeInstallment(1200000, 12, 10);
    const plan = planInstallmentPayoff(records, 'inst-1', 2026, 9)!;
    // seq 1,2 principals (10만 + 10만) + payoff principal (100만) = 120만 = 원래 원금.
    const earlierPrincipal = 100000 + 100000;
    expect(earlierPrincipal + plan.payoffPrincipal).toBe(1200000);
  });

  it('returns null for an unknown id or a month with no slice', () => {
    const records = makeInstallment(1200000, 12, 0);
    expect(planInstallmentPayoff(records, 'nope', 2026, 9)).toBeNull();
    expect(planInstallmentPayoff(records, 'inst-1', 2030, 1)).toBeNull();
  });

  it('settling the last month is a no-op lump (nothing to drop)', () => {
    const records = makeInstallment(1200000, 12, 0);
    const plan = planInstallmentPayoff(records, 'inst-1', 2027, 6); // seq 12 (last)
    expect(plan).toMatchObject({ payoffSeq: 12, count: 12, payoffAmount: 100000, removedCount: 0 });
  });
});
