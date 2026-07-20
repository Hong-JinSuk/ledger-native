import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryItem, Transaction } from '@/types/ledger';

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

  it('payoffInstallment (무이자) lumps the remaining months into the payoff month, drops later ones', () => {
    useLedgerStore.setState({
      records: {
        '2026-07': [slice(1, 7, 40000)],
        '2026-08': [slice(2, 8, 40000)],
        '2026-09': [slice(3, 9, 40000)],
      },
      years: [2026],
      yearMeta: {},
    });
    // Settle in August (seq 2): Aug absorbs Aug+Sep (80,000), Sep is tombstoned, Jul is left alone.
    useLedgerStore.getState().payoffInstallment('inst-1', 2026, 8, 14);
    expect(live('2026-07').map((r) => r.amount)).toEqual([40000]); // already-paid month untouched
    expect(live('2026-08').map((r) => r.amount)).toEqual([80000]); // payoff lump
    expect(live('2026-09')).toEqual([]); // future month dropped
    // Count shrinks to the months actually paid (2), on every surviving slice.
    expect([live('2026-07')[0], live('2026-08')[0]].map((r) => r.installmentCount)).toEqual([2, 2]);
    expect(live('2026-08')[0].id).toBe('seed-2'); // same row, not recreated
  });

  it('payoffInstallment (유이자) waives future interest, keeps 원금 in installmentPrincipal + apr meta', () => {
    // 원금 30만 · 3개월 · 연10%: seq1 102,500 / seq2 101,667 / seq3 100,833 (principal 10만씩).
    const withApr = (seq: number, month: number, amount: number) => ({
      ...slice(seq, month, amount),
      installmentApr: 10,
      installmentPrincipal: 100000,
    });
    useLedgerStore.setState({
      records: {
        '2026-07': [withApr(1, 7, 102500)],
        '2026-08': [withApr(2, 8, 101667)],
        '2026-09': [withApr(3, 9, 100833)],
      },
      years: [2026],
      yearMeta: {},
    });
    // Settle in August (seq 2): remaining principal 200,000 + Aug interest 1,667 = 201,667. Sep interest waived.
    useLedgerStore.getState().payoffInstallment('inst-1', 2026, 8, 14);
    const aug = live('2026-08')[0];
    expect(aug.amount).toBe(201667);
    expect(aug.installmentPrincipal).toBe(200000); // remaining principal, so a later edit re-derives 원금
    expect(aug.installmentApr).toBe(10);
    expect(aug.installmentCount).toBe(2);
    expect(live('2026-09')).toEqual([]);
    expect(live('2026-07')[0].amount).toBe(102500); // paid month keeps its own interest-inclusive charge
  });
});

describe('store: resetLocal (account switch)', () => {
  it('wipes records/years/settings back to a fresh install (fresh seed categories, no records)', () => {
    useLedgerStore.setState({
      records: { '2026-07': [slice(1, 7, 40000)] },
      years: [2020, 2026],
      settings: { ...useLedgerStore.getState().settings, budget: 500000 },
    });

    useLedgerStore.getState().resetLocal();

    const s = useLedgerStore.getState();
    expect(s.records).toEqual({});
    expect(s.settings.budget).toBe(0); // back to DEFAULT_SETTINGS
    expect(s.years).toEqual([new Date().getFullYear()]);
    expect(s.categories.length).toBeGreaterThan(0); // reseeded default categories
  });
});

function plain(id: string, month: number): Transaction {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    year: 2026,
    month,
    day: 14,
    type: '지출',
    category: '식비',
    merchant: '카페',
    amount: 5000,
    note: '',
  };
}

describe('store: moveTransaction (cross-month edit)', () => {
  beforeEach(() => {
    useLedgerStore.setState({ records: {}, years: [2026], yearMeta: {} });
  });

  it('moves Jul→Aug: gone from Jul, in Aug with new year/month, same id/createdAt, bumped updatedAt', () => {
    useLedgerStore.setState({ records: { '2026-07': [plain('t1', 7)] }, years: [2026], yearMeta: {} });
    useLedgerStore.getState().moveTransaction(2026, 7, 't1', 2026, 8, {
      type: '지출',
      amount: 5000,
      category: '식비',
      merchant: '카페',
      day: 20,
      note: '',
    });
    const s = useLedgerStore.getState();
    expect(s.records['2026-07']).toEqual([]); // physically removed from the old bucket
    expect(s.records['2026-08'].map((r) => r.id)).toEqual(['t1']);
    const moved = s.records['2026-08'][0];
    expect([moved.year, moved.month, moved.day]).toEqual([2026, 8, 20]);
    expect(moved.createdAt).toBe('2026-01-01T00:00:00.000Z'); // identity preserved
    expect(moved.updatedAt).toBe('2026-07-14T00:00:00.000Z'); // bumped (mocked nowIso)
  });

  it('moving into a not-yet-present year (Dec 2026 → Jan 2027) adds that year', () => {
    useLedgerStore.setState({ records: { '2026-12': [plain('t1', 12)] }, years: [2026], yearMeta: {} });
    useLedgerStore.getState().moveTransaction(2026, 12, 't1', 2027, 1, {
      type: '지출',
      amount: 5000,
      category: '식비',
      merchant: '카페',
      day: 5,
      note: '',
    });
    const s = useLedgerStore.getState();
    expect(s.records['2027-01'].map((r) => r.id)).toEqual(['t1']);
    expect(s.years).toContain(2027);
    expect(s.yearMeta['2027']).toEqual({ updatedAt: '2026-07-14T00:00:00.000Z', deleted: false });
  });

  it('is a no-op when the row is not in the source bucket', () => {
    useLedgerStore.setState({ records: { '2026-07': [plain('t1', 7)] }, years: [2026], yearMeta: {} });
    useLedgerStore.getState().moveTransaction(2026, 7, 'nope', 2026, 8, {
      type: '지출',
      amount: 0,
      category: '',
      merchant: '',
      day: null,
      note: '',
    });
    const s = useLedgerStore.getState();
    expect(s.records['2026-07'].map((r) => r.id)).toEqual(['t1']);
    expect(s.records['2026-08']).toBeUndefined();
  });
});

describe('store: addTransaction into a new year', () => {
  beforeEach(() => {
    useLedgerStore.setState({ records: {}, years: [2026], yearMeta: {} });
  });

  it('adds the target year when it is not yet present (calendar nav across the year boundary)', () => {
    useLedgerStore.getState().addTransaction({
      year: 2027,
      month: 3,
      amount: 1000,
      type: '지출',
      category: '식비',
      merchant: '',
      day: 1,
      note: '',
    });
    const s = useLedgerStore.getState();
    expect(s.records['2027-03'].length).toBe(1);
    expect(s.years).toContain(2027);
    expect(s.yearMeta['2027']?.deleted).toBe(false);
  });
});

function cat(id: string, type: CategoryItem['type']): CategoryItem {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    name: id,
    icon: 'Tag',
    type,
    subcategories: [],
  };
}

describe('store: reorderCategories', () => {
  it('assigns order = index for the given type, bumps updatedAt, leaves other types untouched', () => {
    useLedgerStore.setState({
      categories: [cat('c1', '지출'), cat('c2', '지출'), cat('inc', '수입')],
    });
    useLedgerStore.getState().reorderCategories('지출', ['c2', 'c1']);
    const cats = useLedgerStore.getState().categories;
    const byId = (id: string) => cats.find((c) => c.id === id)!;
    expect(byId('c2').order).toBe(0);
    expect(byId('c1').order).toBe(1);
    expect(byId('c2').updatedAt).toBe('2026-07-14T00:00:00.000Z'); // bumped (mocked nowIso)
    expect(byId('inc').order).toBeUndefined(); // other type not touched
    expect(byId('inc').updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
