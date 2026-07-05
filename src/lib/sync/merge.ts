import type { CategoryItem, LedgerSnapshot, Settings, Transaction } from '@/types/ledger';
import { monthKey, parseMonthKey } from '@/lib/date';

/**
 * Pure merge engine for the local-first ↔ Google Drive sync (used by the Phase 6 engine,
 * but written & tested here so the model is proven before I/O exists).
 *
 * CLAUDE.md merge rules, applied per synced entity paired by `id`:
 *  - present on only one side       → keep it (union of additions)
 *  - present on both, both alive     → LOCAL wins (Drive is usually the older state)
 *  - present on both, either deleted → DELETE wins (a tombstone is final, regardless of edits)
 */

type Syncable = { id: string; updatedAt: string; deleted: boolean };

/** Later of two ISO-8601 timestamps (ISO strings sort lexicographically = chronologically). */
function maxIso(a: string, b: string): string {
  return a >= b ? a : b;
}

function resolveConflict<T extends Syncable>(local: T, remote: T): T {
  if (local.deleted || remote.deleted) {
    // Delete wins. Keep the deleted record, stamped with the newest updatedAt so the
    // tombstone stays "newest" for any subsequent merge.
    const tombstone = local.deleted ? local : remote;
    return { ...tombstone, updatedAt: maxIso(local.updatedAt, remote.updatedAt) };
  }
  // Both alive & edited → local wins unconditionally (not updatedAt-based, per the rule).
  return local;
}

/** Merge two id-keyed collections of synced entities. */
export function mergeById<T extends Syncable>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of remote) byId.set(item.id, item);
  for (const item of local) {
    const other = byId.get(item.id);
    byId.set(item.id, other ? resolveConflict(item, other) : item);
  }
  return [...byId.values()];
}

/**
 * Merge month-bucketed records. Flattens all buckets, merges globally by id, then re-buckets
 * by each transaction's own year/month — so a transaction that changed month can't duplicate.
 */
export function mergeRecords(
  local: Record<string, Transaction[]>,
  remote: Record<string, Transaction[]>,
): Record<string, Transaction[]> {
  const merged = mergeById(Object.values(local).flat(), Object.values(remote).flat());
  const out: Record<string, Transaction[]> = {};
  for (const t of merged) {
    const key = monthKey(t.year, t.month);
    (out[key] ??= []).push(t);
  }
  return out;
}

function mergeSettings(local: Settings, remote: Settings): Settings {
  // Union monthly budgets so a budget set on either device survives; local wins key conflicts.
  const monthlyBudgets = { ...remote.monthlyBudgets, ...local.monthlyBudgets };
  // Scalar fields: local wins (most recent user context); keep the newest updatedAt.
  return { ...local, monthlyBudgets, updatedAt: maxIso(local.updatedAt, remote.updatedAt) };
}

function mergeYears(
  local: LedgerSnapshot,
  remote: LedgerSnapshot,
  records: Record<string, Transaction[]>,
): number[] {
  const set = new Set<number>([...local.years, ...remote.years]);
  for (const key of Object.keys(records)) set.add(parseMonthKey(key).year);
  return [...set].sort((a, b) => b - a);
}

/** Merge two full ledger snapshots (local wins on true conflicts; deletions always win). */
export function mergeLedger(local: LedgerSnapshot, remote: LedgerSnapshot): LedgerSnapshot {
  const records = mergeRecords(local.records, remote.records);
  const categories: CategoryItem[] = mergeById(local.categories, remote.categories);
  const settings = mergeSettings(local.settings, remote.settings);
  const years = mergeYears(local, remote, records);
  return {
    version: Math.max(local.version, remote.version),
    years,
    records,
    categories,
    settings,
  };
}
