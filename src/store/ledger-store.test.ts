import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Transaction } from '@/types/ledger';

// Mock the only two RN-specific deps so the real store runs under node.
vi.mock('@/lib/id', () => {
  let n = 0;
  return { newId: () => `id-${(n += 1)}`, nowIso: () => '2026-07-14T00:00:00.000Z' };
});
vi.mock('@/lib/storage/ledger-storage', () => ({
  asyncStorageLedger: { load: async () => null, save: async () => {} },
}));

// eslint-disable-next-line import/first
import { useLedgerStore } from '@/store/ledger-store';

function slice(seq: number, month: number, amount: number): Transaction {
  return {
    id: `seed-${seq}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    year: 2026,
    month,
    day: 14,
    type: '지출',
    category: '식비',
    merchant: '할부테스트',
    amount,
    note: '',
    installmentId: 'inst-1',
    installmentSeq: seq,
    installmentCount: 3,
  };
}

function live(month: string) {
  return useLedgerStore.getState().records[month].filter((r) => r.installmentId && !r.deleted);
}

describe('store: installments', () => {
  beforeEach(() => {
    useLedgerStore.setState({ records: {}, years: [2026], yearMeta: {} });
  });

  it('addInstallment splits 120,000 over 3 months into 40,000 each (Jul/Aug/Sep)', () => {
    useLedgerStore.getState().addInstallment({
      year: 2026,
      month: 7,
      amount: 120000,
      count: 3,
      type: '지출',
      category: '식비',
      merchant: '할부테스트',
      day: 14,
      note: '',
    });
    expect(live('2026-07').map((r) => r.amount)).toEqual([40000]);
    expect(live('2026-08').map((r) => r.amount)).toEqual([40000]);
    expect(live('2026-09').map((r) => r.amount)).toEqual([40000]);
    expect([live('2026-07')[0], live('2026-08')[0], live('2026-09')[0]].map((r) => r.installmentSeq)).toEqual([
      1, 2, 3,
    ]);
  });

  it('updateInstallment re-splits, healing a stale [120000, 0, 0] back to 40,000 each', () => {
    useLedgerStore.setState({
      records: {
        '2026-07': [slice(1, 7, 120000)],
        '2026-08': [slice(2, 8, 0)],
        '2026-09': [slice(3, 9, 0)],
      },
      years: [2026],
      yearMeta: {},
    });
    // Re-saving the installment (as the drawer does) with its own total heals the split.
    useLedgerStore.getState().updateInstallment('inst-1', {
      total: 120000,
      count: 3,
      day: 14,
      type: '지출',
      category: '식비',
      merchant: '할부테스트',
      note: '',
    });
    expect(live('2026-07').map((r) => r.amount)).toEqual([40000]);
    expect(live('2026-08').map((r) => r.amount)).toEqual([40000]);
    expect(live('2026-09').map((r) => r.amount)).toEqual([40000]);
    // Same ids (in-place update by seq), not a tombstone-and-recreate.
    expect(live('2026-07')[0].id).toBe('seed-1');
  });

  it('updateInstallment with count 3→2 tombstones the dropped month', () => {
    useLedgerStore.setState({
      records: {
        '2026-07': [slice(1, 7, 40000)],
        '2026-08': [slice(2, 8, 40000)],
        '2026-09': [slice(3, 9, 40000)],
      },
      years: [2026],
      yearMeta: {},
    });
    useLedgerStore.getState().updateInstallment('inst-1', {
      total: 120000,
      count: 2,
      day: 14,
      type: '지출',
      category: '식비',
      merchant: '할부테스트',
      note: '',
    });
    expect(live('2026-07').map((r) => r.amount)).toEqual([60000]);
    expect(live('2026-08').map((r) => r.amount)).toEqual([60000]);
    expect(live('2026-09')).toEqual([]); // September dropped (tombstoned)
  });
});
