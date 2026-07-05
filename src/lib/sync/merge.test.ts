import { describe, expect, it } from 'vitest';

import type { LedgerSnapshot, Transaction } from '@/types/ledger';
import { mergeById, mergeLedger, mergeRecords } from '@/lib/sync/merge';

type Item = { id: string; updatedAt: string; deleted: boolean; v?: string };
const item = (id: string, updatedAt: string, deleted = false, v?: string): Item => ({
  id,
  updatedAt,
  deleted,
  v,
});

function mk(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? 'x',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: p.updatedAt ?? '2026-01-01T00:00:00.000Z',
    deleted: p.deleted ?? false,
    year: p.year ?? 2026,
    month: p.month ?? 7,
    day: p.day === undefined ? 1 : p.day,
    type: p.type ?? '지출',
    category: p.category,
    merchant: p.merchant,
    amount: p.amount ?? 0,
    note: p.note ?? '',
  };
}

describe('mergeById', () => {
  it('unions additions from both sides', () => {
    const merged = mergeById([item('a', 't')], [item('b', 't')]);
    expect(merged.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('local wins when both are alive (even if remote is newer)', () => {
    const local = [item('a', '2026-02-01', false, 'local')];
    const remote = [item('a', '2026-03-01', false, 'remote')];
    expect(mergeById(local, remote)[0].v).toBe('local');
  });

  it('delete wins over a newer edit (local deleted, remote edited)', () => {
    const local = [item('a', '2026-01-01', true, 'local-del')];
    const remote = [item('a', '2026-03-01', false, 'remote-edit')];
    const r = mergeById(local, remote)[0];
    expect(r.deleted).toBe(true);
    expect(r.updatedAt).toBe('2026-03-01'); // tombstone stamped with the newest time
  });

  it('delete wins over a newer edit (remote deleted, local edited)', () => {
    const local = [item('a', '2026-05-01', false, 'local-edit')];
    const remote = [item('a', '2026-01-01', true, 'remote-del')];
    expect(mergeById(local, remote)[0].deleted).toBe(true);
  });
});

describe('mergeRecords', () => {
  it('re-buckets a transaction that changed month without duplicating it', () => {
    // Same id 'a' on both sides, different month; both alive → local (month 7) wins.
    const local = { '2026-07': [mk({ id: 'a', month: 7, updatedAt: '2026-07-01' })] };
    const remote = { '2026-08': [mk({ id: 'a', month: 8, updatedAt: '2026-08-01' })] };
    const merged = mergeRecords(local, remote);
    const all = Object.values(merged).flat();
    expect(all.filter((t) => t.id === 'a')).toHaveLength(1);
    expect(merged['2026-07']?.[0].id).toBe('a');
    expect(merged['2026-08']).toBeUndefined();
  });
});

describe('mergeLedger', () => {
  const base = (over: Partial<LedgerSnapshot>): LedgerSnapshot => ({
    version: 1,
    years: [],
    records: {},
    categories: [],
    settings: {
      budget: 0,
      monthlyBudgets: {},
      currency: '원',
      fixedExpenseTypes: [],
      fixedExpenses: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...over,
  });

  it('unions years (sorted desc) and unions monthly budgets (local wins conflicts)', () => {
    const local = base({
      years: [2026],
      settings: { ...base({}).settings, monthlyBudgets: { '2026-07': 100, '2026-08': 1 } },
    });
    const remote = base({
      years: [2025],
      settings: { ...base({}).settings, monthlyBudgets: { '2026-08': 999, '2025-01': 50 } },
    });
    const merged = mergeLedger(local, remote);
    expect(merged.years).toEqual([2026, 2025]);
    expect(merged.settings.monthlyBudgets).toEqual({ '2026-07': 100, '2026-08': 1, '2025-01': 50 });
  });
});
