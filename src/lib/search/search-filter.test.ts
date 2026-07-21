import { describe, expect, it } from 'vitest';

import type { Transaction } from '@/types/ledger';
import { searchTransactions } from '@/lib/search/search-filter';

let seq = 0;
function tx(p: Partial<Transaction> & { merchant?: string; note?: string }): Transaction {
  seq += 1;
  return {
    id: `t-${seq}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: p.deleted ?? false,
    year: p.year ?? 2026,
    month: p.month ?? 7,
    day: p.day ?? 1,
    type: '지출',
    amount: p.amount ?? 1000,
    merchant: p.merchant ?? '',
    note: p.note ?? '',
  };
}

function recordsOf(...txs: Transaction[]): Record<string, Transaction[]> {
  const out: Record<string, Transaction[]> = {};
  for (const t of txs) (out[`${t.year}-${t.month}`] ??= []).push(t);
  return out;
}

describe('searchTransactions', () => {
  it('empty groups → no results', () => {
    expect(searchTransactions(recordsOf(tx({ merchant: '스타벅스' })), [])).toEqual([]);
  });

  it('matches on 거래처(merchant) OR 메모(note), substring + case-insensitive', () => {
    const a = tx({ merchant: '스타벅스 강남' });
    const b = tx({ merchant: '이마트', note: '스타벅스 기프트카드' });
    const c = tx({ merchant: '쿠팡', note: '생필품' });
    const hits = searchTransactions(recordsOf(a, b, c), [['스타벅스']]);
    expect(hits.map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('AND group: every term must appear', () => {
    const a = tx({ merchant: '할부 이마트', note: '생활용품' }); // 할부 + 생활
    const b = tx({ merchant: '할부 쿠팡', note: '가전' }); // 할부만
    const hits = searchTransactions(recordsOf(a, b), [['할부', '생활']]);
    expect(hits.map((t) => t.id)).toEqual([a.id]);
  });

  it('OR across groups: any group matches', () => {
    const a = tx({ merchant: '월세' });
    const b = tx({ note: '생활비' });
    const c = tx({ merchant: '교통' });
    const hits = searchTransactions(recordsOf(a, b, c), [['월세'], ['생활']]);
    expect(hits.map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('skips tombstoned rows and sorts newest-first', () => {
    const old = tx({ year: 2025, month: 3, day: 2, merchant: '카페' });
    const recent = tx({ year: 2026, month: 8, day: 10, merchant: '카페' });
    const gone = tx({ year: 2026, month: 9, merchant: '카페', deleted: true });
    const hits = searchTransactions(recordsOf(old, recent, gone), [['카페']]);
    expect(hits.map((t) => t.id)).toEqual([recent.id, old.id]); // recent first, deleted excluded
  });
});
