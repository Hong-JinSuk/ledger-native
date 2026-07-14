import { describe, expect, it } from 'vitest';

import { migrateLedgerSnapshot } from '@/lib/ledger/migrate';
import type { CategoryItem, LedgerSnapshot, Transaction } from '@/types/ledger';

const NOW = '2026-07-14T00:00:00.000Z';
const OLD = '2024-01-01T00:00:00.000Z';

function cat(id: string, name: string, icon: string, subcategories: string[] = ['기타']): CategoryItem {
  return { id, name, icon, type: '지출', subcategories, createdAt: OLD, updatedAt: OLD, deleted: false };
}

function tx(id: string, category: string): Transaction {
  return {
    id,
    createdAt: OLD,
    updatedAt: OLD,
    deleted: false,
    year: 2026,
    month: 7,
    day: 1,
    type: '지출',
    category,
    merchant: '',
    amount: 1000,
    note: '',
  };
}

function v1Snapshot(): LedgerSnapshot {
  return {
    version: 1,
    years: [2026],
    records: {
      '2026-07': [
        tx('t1', '카페/간식'),
        tx('t2', '온라인쇼핑'),
        tx('t3', '패션/쇼핑'),
        tx('t4', '식비'),
      ],
    },
    categories: [
      cat('cat-1', '식비', 'Utensils', ['커피/음료', '기타간식', '기타']),
      cat('cat-2', '카페/간식', 'Coffee'),
      cat('cat-5', '온라인쇼핑', 'ShoppingBag'),
      cat('cat-6', '패션/쇼핑', 'Shirt'),
      cat('cat-7', '뷰티/미용', 'Scissors'),
    ],
    settings: {
      budget: 0,
      monthlyBudgets: {},
      currency: '원',
      fixedExpenseTypes: [],
      fixedExpenses: [],
      updatedAt: OLD,
    },
  };
}

const byId = <T extends { id: string }>(items: T[]) => Object.fromEntries(items.map((i) => [i.id, i]));

describe('migrateLedgerSnapshot v1 → v2 category consolidation', () => {
  it('tombstones 카페/간식 (cat-2) and 온라인쇼핑 (cat-5), stamped with `now`', () => {
    const cats = byId(migrateLedgerSnapshot(v1Snapshot(), NOW).categories);
    expect(cats['cat-2'].deleted).toBe(true);
    expect(cats['cat-2'].updatedAt).toBe(NOW);
    expect(cats['cat-5'].deleted).toBe(true);
    expect(cats['cat-5'].updatedAt).toBe(NOW);
  });

  it('renames 패션/쇼핑 (cat-6) into the 쇼핑 umbrella, both old cats as subcategories', () => {
    const shop = byId(migrateLedgerSnapshot(v1Snapshot(), NOW).categories)['cat-6'];
    expect(shop.name).toBe('쇼핑');
    expect(shop.deleted).toBe(false);
    expect(shop.icon).toBe('ShoppingBag');
    expect(shop.subcategories).toEqual(['온라인쇼핑', '패션/쇼핑', '기타']);
  });

  it('leaves 식비 own subcategories intact — a retired category adds no leftover label', () => {
    const food = byId(migrateLedgerSnapshot(v1Snapshot(), NOW).categories)['cat-1'];
    expect(food.subcategories).toEqual(['커피/음료', '기타간식', '기타']);
  });

  it('v3 heals an interim-v2 식비 by stripping the redundant 카페/간식 subcategory', () => {
    const interimV2: LedgerSnapshot = {
      ...v1Snapshot(),
      version: 2,
      categories: [cat('cat-1', '식비', 'Utensils', ['커피/음료', '기타간식', '카페/간식', '기타'])],
    };
    const out = migrateLedgerSnapshot(interimV2, NOW);
    expect(out.version).toBe(4);
    const food = out.categories.find((c) => c.id === 'cat-1')!;
    expect(food.subcategories).toEqual(['커피/음료', '기타간식', '기타']);
    expect(food.updatedAt).toBe(NOW);
  });

  it('leaves 뷰티/미용 (cat-7) independent and untouched', () => {
    const beauty = byId(migrateLedgerSnapshot(v1Snapshot(), NOW).categories)['cat-7'];
    expect(beauty.name).toBe('뷰티/미용');
    expect(beauty.deleted).toBe(false);
    expect(beauty.updatedAt).toBe(OLD);
  });

  it('remaps transaction categories to the surviving parent, bumping only the ones it touches', () => {
    const rows = byId(migrateLedgerSnapshot(v1Snapshot(), NOW).records['2026-07']);
    expect(rows['t1'].category).toBe('식비'); // 카페/간식 → 식비
    expect(rows['t2'].category).toBe('쇼핑'); // 온라인쇼핑 → 쇼핑
    expect(rows['t3'].category).toBe('쇼핑'); // 패션/쇼핑 → 쇼핑
    expect(rows['t1'].updatedAt).toBe(NOW);
    // An untouched category leaves the row (and its updatedAt) exactly as-is.
    expect(rows['t4'].category).toBe('식비');
    expect(rows['t4'].updatedAt).toBe(OLD);
  });

  it('bumps the snapshot version to the current version (4)', () => {
    expect(migrateLedgerSnapshot(v1Snapshot(), NOW).version).toBe(4);
  });

  it('is idempotent — a second pass is a no-op and returns the same reference', () => {
    const once = migrateLedgerSnapshot(v1Snapshot(), NOW);
    const twice = migrateLedgerSnapshot(once, '2027-01-01T00:00:00.000Z');
    expect(twice).toBe(once);
  });

  it('returns an already-current snapshot untouched (same reference)', () => {
    const v4: LedgerSnapshot = { ...v1Snapshot(), version: 4 };
    expect(migrateLedgerSnapshot(v4, NOW)).toBe(v4);
  });
});

describe('migrateLedgerSnapshot v3 → v4 (자동차·내계좌이체·상여금 merges)', () => {
  // The migration keys off category id + transaction category NAME, not `type`, so the type-agnostic
  // `cat`/`tx` helpers (which stamp '지출') are fine here even for the income/transfer categories.
  function v3Snapshot(): LedgerSnapshot {
    return {
      version: 3,
      years: [2026],
      records: {
        '2026-07': [tx('a1', '자동차'), tx('a2', '내계좌이체'), tx('a3', '상여금'), tx('a4', '교통')],
      },
      categories: [
        cat('cat-8', '교통', 'Bus'),
        cat('cat-9', '자동차', 'Car'),
        cat('cat-101', '급여', 'Banknote'),
        cat('cat-102', '상여금', 'Coins'),
        cat('cat-201', '내계좌이체', 'ArrowRightLeft'),
        cat('cat-202', '이체', 'ArrowRight'),
      ],
      settings: {
        budget: 0,
        monthlyBudgets: {},
        currency: '원',
        fixedExpenseTypes: [],
        fixedExpenses: [],
        updatedAt: OLD,
      },
    };
  }

  it('tombstones the retired children (자동차·내계좌이체·상여금)', () => {
    const c = byId(migrateLedgerSnapshot(v3Snapshot(), NOW).categories);
    expect(c['cat-9'].deleted).toBe(true);
    expect(c['cat-201'].deleted).toBe(true);
    expect(c['cat-102'].deleted).toBe(true);
    expect(c['cat-9'].updatedAt).toBe(NOW);
  });

  it('folds each retired name into its parent as a subcategory (기타 stays last)', () => {
    const c = byId(migrateLedgerSnapshot(v3Snapshot(), NOW).categories);
    expect(c['cat-8'].subcategories).toEqual(['자동차', '기타']); // 교통
    expect(c['cat-202'].subcategories).toEqual(['내계좌이체', '기타']); // 이체
    expect(c['cat-101'].subcategories).toEqual(['상여금', '기타']); // 급여
  });

  it('remaps the retired categories transactions to their parent, leaving others as-is', () => {
    const r = byId(migrateLedgerSnapshot(v3Snapshot(), NOW).records['2026-07']);
    expect(r['a1'].category).toBe('교통'); // 자동차 → 교통
    expect(r['a2'].category).toBe('이체'); // 내계좌이체 → 이체
    expect(r['a3'].category).toBe('급여'); // 상여금 → 급여
    expect(r['a1'].updatedAt).toBe(NOW);
    expect(r['a4'].category).toBe('교통'); // untouched
    expect(r['a4'].updatedAt).toBe(OLD);
  });

  it('bumps version 3 → 4', () => {
    expect(migrateLedgerSnapshot(v3Snapshot(), NOW).version).toBe(4);
  });
});
