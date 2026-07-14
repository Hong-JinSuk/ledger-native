import type { CategoryItem, LedgerSnapshot, Transaction } from '@/types/ledger';

/**
 * Forward-only upgrades applied to a persisted/synced snapshot as it's loaded — and to any incoming
 * Drive snapshot before merge, so an older file's data doesn't slip in un-migrated. Each step is gated
 * on the snapshot version and stays sync-safe: retirements are soft-delete tombstones (delete wins in
 * the merge) and renames/edits stay "alive" (local wins), so every change rides the existing merge
 * without resurrecting. Idempotent — a snapshot already at the target version is returned untouched.
 */

/** 지출 category consolidation: each name on the left collapses into the surviving parent on the right. */
const CATEGORY_REMAP_V2: Record<string, string> = {
  '카페/간식': '식비',
  '온라인쇼핑': '쇼핑',
  '패션/쇼핑': '쇼핑',
};

/** Prepend `front` labels (deduped) ahead of the existing ones — seeds 쇼핑's subcategories. */
function withLeadingSubcategories(front: string[], existing: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [...front, ...existing]) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * v1 → v2: fewer top-level 지출 categories, granularity pushed down into subcategories.
 *  - 카페/간식 (cat-2) is retired; its transactions remap to 식비, which already covers it. Top-level tombstoned.
 *  - 온라인쇼핑 (cat-5) + 패션/쇼핑 (cat-6) collapse into one 쇼핑 (cat-6); both live on as its subcategories.
 *  - 뷰티/미용 stays independent.
 * A retired category leaves no leftover subcategory on its parent — merging it in means it's gone, not
 * duplicated as a label. Existing transactions are remapped by category NAME (their only category ref).
 */
function migrateV2(snapshot: LedgerSnapshot, now: string): LedgerSnapshot {
  const categories: CategoryItem[] = snapshot.categories.map((c) => {
    if (c.id === 'cat-2' || c.id === 'cat-5') {
      // 카페/간식, 온라인쇼핑 retired → tombstone so the removal survives the Drive merge (delete wins).
      return c.deleted ? c : { ...c, deleted: true, updatedAt: now };
    }
    if (c.id === 'cat-6' && c.name === '패션/쇼핑') {
      // Becomes the 쇼핑 umbrella; the two old shopping categories carry on as its subcategories.
      return {
        ...c,
        name: '쇼핑',
        icon: 'ShoppingBag',
        subcategories: withLeadingSubcategories(['온라인쇼핑', '패션/쇼핑'], c.subcategories),
        updatedAt: now,
      };
    }
    return c;
  });

  const records: Record<string, Transaction[]> = {};
  for (const [key, rows] of Object.entries(snapshot.records)) {
    records[key] = rows.map((r) => {
      const to = r.category ? CATEGORY_REMAP_V2[r.category] : undefined;
      // Alive rows local-win the merge, so the remap carries through; bump updatedAt to reflect the edit.
      return to ? { ...r, category: to, updatedAt: now } : r;
    });
  }

  return { ...snapshot, categories, records };
}

/**
 * v2 → v3: heal an interim v2 that folded a redundant '카페/간식' subcategory into 식비. 식비 already
 * carries its own cafe/snack breakdown (커피/음료 · 기타간식 · …), so the extra label was noise — strip it
 * from cat-1 if present. Transactions stay remapped to 식비 by v2; only the redundant label is removed.
 */
function migrateV3(snapshot: LedgerSnapshot, now: string): LedgerSnapshot {
  let changed = false;
  const categories = snapshot.categories.map((c) => {
    if (c.id !== 'cat-1' || !c.subcategories.includes('카페/간식')) return c;
    changed = true;
    return { ...c, subcategories: c.subcategories.filter((s) => s !== '카페/간식'), updatedAt: now };
  });
  return changed ? { ...snapshot, categories } : snapshot;
}

/**
 * v3 → v4: three more consolidations, same shape as v2's 쇼핑 — retire a child category (tombstone),
 * fold its name into the parent as a subcategory, and remap the child's transactions to the parent:
 *  - 자동차 (cat-9) → 교통 (cat-8)
 *  - 내계좌이체 (cat-201) → 이체 (cat-202)
 *  - 상여금 (cat-102) → 급여 (cat-101)
 */
const V4_CHILD_TO_PARENT: Record<string, string> = { 'cat-9': 'cat-8', 'cat-201': 'cat-202', 'cat-102': 'cat-101' };
/** Parent category id → the retired child's name to fold in as a subcategory. */
const V4_PARENT_SUBCATEGORY: Record<string, string> = { 'cat-8': '자동차', 'cat-202': '내계좌이체', 'cat-101': '상여금' };
/** Transaction category NAME remap for the retired children. */
const V4_REMAP: Record<string, string> = { '자동차': '교통', '내계좌이체': '이체', '상여금': '급여' };

function migrateV4(snapshot: LedgerSnapshot, now: string): LedgerSnapshot {
  const categories: CategoryItem[] = snapshot.categories.map((c) => {
    if (V4_CHILD_TO_PARENT[c.id]) {
      // Retired child → tombstone so the removal survives the Drive merge (delete wins).
      return c.deleted ? c : { ...c, deleted: true, updatedAt: now };
    }
    const sub = V4_PARENT_SUBCATEGORY[c.id];
    if (sub && !c.subcategories.includes(sub)) {
      // Fold the child's name into the parent as a subcategory (front, 기타 stays last) — like 쇼핑.
      return { ...c, subcategories: withLeadingSubcategories([sub], c.subcategories), updatedAt: now };
    }
    return c;
  });

  const records: Record<string, Transaction[]> = {};
  for (const [key, rows] of Object.entries(snapshot.records)) {
    records[key] = rows.map((r) => {
      const to = r.category ? V4_REMAP[r.category] : undefined;
      return to ? { ...r, category: to, updatedAt: now } : r;
    });
  }

  return { ...snapshot, categories, records };
}

/**
 * Migrate a snapshot up to the current version, stepping through each version's transform. `now` stamps
 * `updatedAt` on the entities a step touches (pass the caller's clock). Returns the SAME reference when
 * nothing ran, so callers can cheaply detect "did a migration happen?" via identity.
 */
export function migrateLedgerSnapshot(snapshot: LedgerSnapshot, now: string): LedgerSnapshot {
  const from = snapshot.version ?? 1;
  let version = from;
  let next = snapshot;
  if (version < 2) {
    next = migrateV2(next, now);
    version = 2;
  }
  if (version < 3) {
    next = migrateV3(next, now);
    version = 3;
  }
  if (version < 4) {
    next = migrateV4(next, now);
    version = 4;
  }
  return version === from ? snapshot : { ...next, version };
}
