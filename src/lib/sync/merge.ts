import type {
  CategoryItem,
  FixedExpense,
  LedgerSnapshot,
  Settings,
  Transaction,
  YearMeta,
} from '@/types/ledger';
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

/** A time before any real edit — stamped on legacy fixed expenses that predate SyncMeta. */
const FIXED_EXPENSE_EPOCH = '1970-01-01T00:00:00.000Z';

/**
 * Backfill sync meta on a fixed expense read from an older file/snapshot (before FixedExpense
 * carried {@link SyncMeta}). Defaults make it "oldest & alive" so a real dated edit on the other
 * side wins the tie and it's never mistaken for a tombstone. A no-op once meta is present.
 */
export function normalizeFixedExpense(e: FixedExpense): FixedExpense {
  return {
    ...e,
    createdAt: e.createdAt || FIXED_EXPENSE_EPOCH,
    updatedAt: e.updatedAt || FIXED_EXPENSE_EPOCH,
    deleted: e.deleted ?? false,
  };
}

function mergeSettings(local: Settings, remote: Settings): Settings {
  // Union monthly budgets so a budget set on either device survives; local wins key conflicts.
  const monthlyBudgets = { ...remote.monthlyBudgets, ...local.monthlyBudgets };
  // Per-month fixed-expense snapshots. A month's snapshot is editable in-place (add/edit/delete on that
  // month), so merge it like records: union month keys, then WITHIN each month pair items by id — union
  // additions, local wins edits, delete wins. (Whole-key local-wins would drop the other device's edits
  // to the same month.) Items carry SyncMeta; legacy ones get it backfilled.
  const monthlyFixedExpenses: Record<string, FixedExpense[]> = {};
  const feMonthKeys = new Set<string>([
    ...Object.keys(local.monthlyFixedExpenses ?? {}),
    ...Object.keys(remote.monthlyFixedExpenses ?? {}),
  ]);
  for (const key of feMonthKeys) {
    const l = local.monthlyFixedExpenses?.[key];
    const r = remote.monthlyFixedExpenses?.[key];
    monthlyFixedExpenses[key] =
      l && r
        ? mergeById(l.map(normalizeFixedExpense), r.map(normalizeFixedExpense))
        : (l ?? r ?? []).map(normalizeFixedExpense);
  }
  // Fixed expenses are their OWN id-keyed synced collection, not a scalar: union additions, local
  // wins edits, delete wins. Previously `{ ...local }` overwrote them wholesale, so the other
  // device's additions were dropped — and the next push destroyed them on Drive too.
  const fixedExpenses = mergeById(
    local.fixedExpenses.map(normalizeFixedExpense),
    remote.fixedExpenses.map(normalizeFixedExpense),
  );
  // Type labels have no id/tombstone → union (dedupe), local order first. A deleted label can
  // resurrect, but it's cosmetic (the expense keeps its own `type` string regardless).
  const fixedExpenseTypes = [
    ...local.fixedExpenseTypes,
    ...remote.fixedExpenseTypes.filter((t) => !local.fixedExpenseTypes.includes(t)),
  ];
  // Default budget is a bare scalar (no per-item meta), so plain 'local wins' never lets a budget set
  // on another device sync in. Merge it by its own timestamp — the most recently edited budget wins.
  const localBudgetTs = local.budgetUpdatedAt ?? '';
  const remoteBudgetTs = remote.budgetUpdatedAt ?? '';
  const budgetFromLocal = localBudgetTs >= remoteBudgetTs;
  // Reset tombstones — a month cleared on either device STAYS cleared (delete wins), so its budget +
  // snapshot are dropped from the union above instead of being resurrected by the other side. Other
  // scalar fields (currency): local wins; keep the newest updatedAt.
  const clearedMonths = [
    ...new Set([...(local.clearedMonths ?? []), ...(remote.clearedMonths ?? [])]),
  ];
  for (const key of clearedMonths) {
    delete monthlyBudgets[key];
    delete monthlyFixedExpenses[key];
  }
  return {
    ...local,
    budget: budgetFromLocal ? local.budget : remote.budget,
    budgetUpdatedAt: maxIso(localBudgetTs, remoteBudgetTs) || undefined,
    monthlyBudgets,
    monthlyFixedExpenses,
    fixedExpenses,
    fixedExpenseTypes,
    clearedMonths,
    updatedAt: maxIso(local.updatedAt, remote.updatedAt),
  };
}

/** Merge per-year add/delete state: for each year keep the entry with the newest updatedAt (local wins ties). */
function mergeYearMeta(
  local: Record<string, YearMeta> = {},
  remote: Record<string, YearMeta> = {},
): Record<string, YearMeta> {
  const out: Record<string, YearMeta> = { ...remote };
  for (const [year, meta] of Object.entries(local)) {
    const other = out[year];
    out[year] = !other || meta.updatedAt >= other.updatedAt ? meta : other;
  }
  return out;
}

/**
 * Resolve which years are present after a merge. A year shows if it has active records or is
 * declared present (legacy `years` list / a non-deleted yearMeta), and a delete tombstone removes it
 * — UNLESS it still holds active data. This is what makes a deleted year stay deleted (the old plain
 * union just brought it back).
 */
function mergeYears(
  local: LedgerSnapshot,
  remote: LedgerSnapshot,
  records: Record<string, Transaction[]>,
  yearMeta: Record<string, YearMeta>,
): number[] {
  // Years still holding ≥1 non-deleted transaction are always present (real data wins).
  const active = new Set<number>();
  for (const [key, rows] of Object.entries(records)) {
    if (rows.some((r) => !r.deleted)) active.add(parseMonthKey(key).year);
  }

  // Declared present: legacy year lists (pre-yearMeta files) + years explicitly added via yearMeta.
  const declared = new Set<number>([...local.years, ...remote.years]);
  for (const [year, meta] of Object.entries(yearMeta)) {
    if (!meta.deleted) declared.add(Number(year));
  }
  // Deleted-year tombstones remove the year (unless it still has active data).
  for (const [year, meta] of Object.entries(yearMeta)) {
    if (meta.deleted && !active.has(Number(year))) declared.delete(Number(year));
  }

  return [...new Set([...declared, ...active])].sort((a, b) => b - a);
}

/** Merge two full ledger snapshots (local wins on true conflicts; deletions always win). */
export function mergeLedger(local: LedgerSnapshot, remote: LedgerSnapshot): LedgerSnapshot {
  const records = mergeRecords(local.records, remote.records);
  const categories: CategoryItem[] = mergeById(local.categories, remote.categories);
  const settings = mergeSettings(local.settings, remote.settings);
  const yearMeta = mergeYearMeta(local.yearMeta, remote.yearMeta);
  const years = mergeYears(local, remote, records, yearMeta);
  return {
    version: Math.max(local.version, remote.version),
    years,
    yearMeta,
    records,
    categories,
    settings,
  };
}
