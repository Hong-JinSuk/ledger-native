import { create } from 'zustand';

import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { DEFAULT_SETTINGS, LEDGER_SNAPSHOT_VERSION } from '@/constants/ledger';
import { monthKey } from '@/lib/date';
import { newId, nowIso } from '@/lib/id';
import { planInstallmentSlices } from '@/lib/ledger/installment';
import { migrateLedgerSnapshot } from '@/lib/ledger/migrate';
import { asyncStorageLedger, type LedgerStorage } from '@/lib/storage/ledger-storage';
import { mergeLedger, normalizeFixedExpense } from '@/lib/sync/merge';
import type {
  CategoryItem,
  FixedExpense,
  LedgerSnapshot,
  Settings,
  Transaction,
  TransactionType,
  YearMeta,
} from '@/types/ledger';

const storage: LedgerStorage = asyncStorageLedger;

/**
 * Serialize persistence so rapid mutations can't race on the single storage key (last write wins,
 * in order). Write-through is fire-and-forget: local state is the source of truth, so a failed
 * write is logged and simply retried by the next mutation — local data is never lost.
 */
let saveChain: Promise<void> = Promise.resolve();
function persistSnapshot(snapshot: LedgerSnapshot): void {
  saveChain = saveChain
    .then(() => storage.save(snapshot))
    .catch((err) => console.warn('[ledger] persist failed', err));
}

/**
 * The base list to edit for a month's fixed expenses: its frozen snapshot if it has one, else a fresh
 * copy of the live template (the first edit persists this copy — freezing the month). Copying keeps
 * per-month edits off the shared template. Includes tombstones (snapshot case) so merges stay correct.
 */
function monthSnapshotBase(settings: Settings, key: string): FixedExpense[] {
  // A month's OWN snapshot, or empty. The Settings template is never auto-seeded here — only an explicit
  // "apply defaults" copies it in. So editing a not-yet-set-up month's fixed expenses starts from nothing.
  return settings.monthlyFixedExpenses?.[key] ?? [];
}

export interface NewTransactionInput {
  year: number;
  month: number;
  day?: number | null;
  type?: TransactionType | '';
  category?: string;
  merchant?: string;
  amount?: number;
  note?: string;
}

/** A new installment purchase: a NewTransactionInput whose `amount` is the TOTAL, split over `count` months. */
export interface NewInstallmentInput extends NewTransactionInput {
  /** Number of months to split the total across (≥ 2). */
  count: number;
}

/** Fields of a transaction that may be edited in place (year/month are locked — see updateTransaction). */
export type TransactionPatch = Partial<
  Pick<Transaction, 'day' | 'type' | 'category' | 'merchant' | 'amount' | 'note'>
>;

export type CategoryInput = Pick<CategoryItem, 'name' | 'icon' | 'type' | 'subcategories'>;

/** The editable fields of a fixed expense (sync meta is stamped by the store, not the caller). */
export type FixedExpenseInput = {
  title: string;
  type: string;
  amount: number;
  date: number | null;
  note?: string;
};

export interface LedgerState {
  /** True once the on-device snapshot has been loaded (or seeded on first launch). */
  hydrated: boolean;
  years: number[];
  /** Per-year add/delete state (keyed by year string) so year deletions survive the Drive merge. */
  yearMeta: Record<string, YearMeta>;
  records: Record<string, Transaction[]>;
  categories: CategoryItem[];
  settings: Settings;

  hydrate: () => Promise<void>;
  /** Merge a Drive snapshot into local state (re-merged against current edits, so nothing is clobbered). */
  applySyncedSnapshot: (incoming: LedgerSnapshot) => void;
  /**
   * Wipe local state back to a fresh install (fresh seed categories/settings, no records). Used when a
   * DIFFERENT Google account signs in on this device (see sync-service `ensureAccountScope`) so accounts
   * never bleed together — the previous account's data stays safe in its own Drive.
   */
  resetLocal: () => void;

  addYear: (year: number) => void;
  deleteYear: (year: number) => void;
  ensureMonthInitialized: (year: number, month: number) => void;

  addTransaction: (input: NewTransactionInput) => Transaction;
  /**
   * Record an expense split into `input.count` monthly installments — one Transaction per month, linked
   * by a shared installmentId, each in its own bucket. Writes ONLY to records/years (never Settings), so
   * a future-month slice can't configure that month or disturb its "set up this month" prompt.
   */
  addInstallment: (input: NewInstallmentInput) => void;
  updateTransaction: (year: number, month: number, id: string, patch: TransactionPatch) => void;
  /**
   * Move a transaction to a different month bucket (an edit that changes its month). Keeps the same
   * id/createdAt; the merge flattens by id globally and re-buckets by year/month, so it stays
   * sync-safe — no duplicate, no tombstone (the id is re-homed, not deleted). See mergeRecords.
   */
  moveTransaction: (
    fromYear: number,
    fromMonth: number,
    id: string,
    toYear: number,
    toMonth: number,
    patch: TransactionPatch,
  ) => void;
  deleteTransaction: (year: number, month: number, id: string) => void;
  /** Soft-delete every slice of an installment across all its month buckets (removes the whole 할부). */
  deleteInstallment: (installmentId: string) => void;
  /**
   * Edit a whole installment as one unit: re-split `input.total` over `input.count` months from its
   * ORIGINAL start month (so editing any slice re-derives them all). Existing months are updated in
   * place (matched by seq → ids stay stable); a shrunk count tombstones dropped months, a grown count
   * adds new ones. Records/years only — never Settings.
   */
  updateInstallment: (
    installmentId: string,
    input: {
      total: number;
      count: number;
      day: number | null;
      type: TransactionType | '';
      category?: string;
      merchant?: string;
      note?: string;
    },
  ) => void;
  /** Soft-delete every record in a month (parallels deleteYear, one bucket). */
  deleteMonth: (year: number, month: number) => void;

  updateMonthlyBudget: (year: number, month: number, budget: number | null) => void;
  /** Set up a month from the Settings defaults: default budget + a frozen COPY of the default fixed expenses. */
  applyDefaultsToMonth: (year: number, month: number) => void;
  /** Reset a month back to "not set up": clear its budget + fixed snapshot (tombstoned so it survives sync). */
  resetMonthSetup: (year: number, month: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  addFixedExpense: (input: FixedExpenseInput) => FixedExpense;
  updateFixedExpense: (id: string, patch: Partial<FixedExpenseInput>) => void;
  deleteFixedExpense: (id: string) => void;

  /** Edit ONE month's frozen fixed-expense snapshot (seeds from the template if the month isn't frozen yet). */
  addMonthFixedExpense: (year: number, month: number, input: FixedExpenseInput) => FixedExpense;
  updateMonthFixedExpense: (
    year: number,
    month: number,
    id: string,
    patch: Partial<FixedExpenseInput>,
  ) => void;
  deleteMonthFixedExpense: (year: number, month: number, id: string) => void;

  addCategory: (input: CategoryInput) => CategoryItem;
  updateCategory: (id: string, patch: Partial<CategoryInput>) => void;
  deleteCategory: (id: string) => void;
  /**
   * Persist the user's manual category order (drag-to-reorder in the manager): assigns order = index
   * to each id, for that type only. Bumps updatedAt so the arrangement wins the Drive merge. Per-id
   * order can drift slightly under concurrent cross-device reorders, but never breaks (sort is total).
   */
  reorderCategories: (type: TransactionType, orderedIds: string[]) => void;
}

export const useLedgerStore = create<LedgerState>((set, get) => {
  /** Snapshot the persistable slice and write it through to storage. */
  const persist = () => {
    const { years, yearMeta, records, categories, settings } = get();
    persistSnapshot({
      version: LEDGER_SNAPSHOT_VERSION,
      years,
      yearMeta,
      records,
      categories,
      settings,
    });
  };

  return {
    hydrated: false,
    years: [new Date().getFullYear()],
    yearMeta: {},
    records: {},
    categories: DEFAULT_CATEGORIES,
    settings: DEFAULT_SETTINGS,

    hydrate: async () => {
      const stored = await storage.load();
      if (stored) {
        // Upgrade an older on-device snapshot to the current shape (e.g. v2 category consolidation)
        // before it becomes live state. Returns the SAME ref when nothing ran, so we only re-persist
        // when a migration actually changed something.
        const snapshot = migrateLedgerSnapshot(stored, nowIso());
        const loaded: Settings = {
          ...DEFAULT_SETTINGS,
          ...snapshot.settings,
          // Backfill sync meta on fixed expenses saved before FixedExpense carried it, so every
          // in-memory expense has id/updatedAt/deleted for the merge.
          fixedExpenses: (snapshot.settings?.fixedExpenses ?? []).map(normalizeFixedExpense),
        };
        set({
          years: snapshot.years?.length ? snapshot.years : [new Date().getFullYear()],
          yearMeta: snapshot.yearMeta ?? {},
          records: snapshot.records ?? {},
          categories: snapshot.categories?.length ? snapshot.categories : DEFAULT_CATEGORIES,
          settings: loaded,
          hydrated: true,
        });
        // Persist the upgraded snapshot so the migration runs once, not on every launch.
        if (snapshot !== stored) persist();
      } else {
        // First launch: mark hydrated and seed defaults into storage.
        set({ hydrated: true });
        persist();
      }
    },

    applySyncedSnapshot: (incoming) => {
      set((s) => {
        const current: LedgerSnapshot = {
          version: LEDGER_SNAPSHOT_VERSION,
          years: s.years,
          yearMeta: s.yearMeta,
          records: s.records,
          categories: s.categories,
          settings: s.settings,
        };
        // Upgrade an older Drive file to the current shape before merging, so v1 data (old category
        // names / retired categories) doesn't slip in un-migrated. Idempotent on already-current files.
        const migratedIncoming = migrateLedgerSnapshot(incoming, nowIso());
        // Re-merge here (not a blind overwrite): if the user edited during the async pull, those
        // current values win, so an in-flight sync can never clobber fresh local work.
        const merged = mergeLedger(current, migratedIncoming);
        return {
          years: merged.years,
          yearMeta: merged.yearMeta ?? {},
          records: merged.records,
          categories: merged.categories,
          settings: merged.settings,
        };
      });
      persist();
    },

    resetLocal: () => {
      // Back to a first-launch state (same shape as the store's initial values). hydrated stays true —
      // we're already past boot; this is an account switch, not a reload.
      set({
        years: [new Date().getFullYear()],
        yearMeta: {},
        records: {},
        categories: DEFAULT_CATEGORIES,
        settings: DEFAULT_SETTINGS,
      });
      // Overwrite the on-device mirror so it reflects "empty for the new account" before the pull.
      persist();
    },

    addYear: (year) => {
      set((s) => ({
        years: s.years.includes(year) ? s.years : [...s.years, year].sort((a, b) => b - a),
        // Stamp (un-tombstone) the year so adding — including re-adding a deleted year — syncs and wins by recency.
        yearMeta: { ...s.yearMeta, [year]: { updatedAt: nowIso(), deleted: false } },
      }));
      persist();
    },

    deleteYear: (year) => {
      set((s) => {
        const ts = nowIso();
        const records = { ...s.records };
        for (const key of Object.keys(records)) {
          if (key.startsWith(`${year}-`)) {
            // Soft-delete (tombstone) rather than drop, so the deletion survives the Drive merge.
            records[key] = records[key].map((r) =>
              r.deleted ? r : { ...r, deleted: true, updatedAt: ts },
            );
          }
        }
        return {
          years: s.years.filter((y) => y !== year),
          records,
          // Year-level tombstone: keeps the year itself deleted through the merge (not just its rows).
          yearMeta: { ...s.yearMeta, [year]: { updatedAt: ts, deleted: true } },
        };
      });
      persist();
    },

    ensureMonthInitialized: (year, month) => {
      const key = monthKey(year, month);
      if (!get().records[key]) {
        set((s) => ({ records: { ...s.records, [key]: [] } }));
        persist();
      }
    },

    addTransaction: (input) => {
      const key = monthKey(input.year, input.month);
      const ts = nowIso();
      const tx: Transaction = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deleted: false,
        year: input.year,
        month: input.month,
        day: input.day ?? null,
        type: input.type ?? '',
        category: input.category ?? '',
        merchant: input.merchant ?? '',
        amount: input.amount ?? 0,
        note: input.note ?? '',
      };
      set((s) => {
        const hasYear = s.years.includes(input.year);
        return {
          records: { ...s.records, [key]: [...(s.records[key] ?? []), tx] },
          // A month chosen via the calendar's nav can land in a year not yet present → add it so the
          // record is visible & syncs (years/yearMeta only, like addInstallment's cross-year slices).
          years: hasYear ? s.years : [...s.years, input.year].sort((a, b) => b - a),
          yearMeta: hasYear
            ? s.yearMeta
            : { ...s.yearMeta, [input.year]: { updatedAt: ts, deleted: false } },
        };
      });
      persist();
      return tx;
    },

    addInstallment: (input) => {
      const slices = planInstallmentSlices(
        input.year,
        input.month,
        input.amount ?? 0,
        input.count,
        input.day ?? null,
      );
      const installmentId = newId();
      const ts = nowIso();
      const count = slices.length;
      set((s) => {
        const records = { ...s.records };
        const years = new Set(s.years);
        const yearMeta = { ...s.yearMeta };
        for (const slice of slices) {
          const key = monthKey(slice.year, slice.month);
          const tx: Transaction = {
            id: newId(),
            createdAt: ts,
            updatedAt: ts,
            deleted: false,
            year: slice.year,
            month: slice.month,
            day: slice.day,
            type: input.type ?? '지출',
            category: input.category ?? '',
            merchant: input.merchant ?? '',
            amount: slice.amount,
            note: input.note ?? '',
            installmentId,
            installmentSeq: slice.seq,
            installmentCount: count,
          };
          records[key] = [...(records[key] ?? []), tx];
          // A later slice can fall in a not-yet-present year (Dec → next Jan). Add the year so the charge
          // is visible & merges — this touches years/yearMeta only, never a month's budget/fixed setup.
          if (!years.has(slice.year)) {
            years.add(slice.year);
            yearMeta[slice.year] = { updatedAt: ts, deleted: false };
          }
        }
        return { records, years: [...years].sort((a, b) => b - a), yearMeta };
      });
      persist();
    },

    updateTransaction: (year, month, id, patch) => {
      const key = monthKey(year, month);
      set((s) => {
        const rows = s.records[key];
        if (!rows) return s;
        return {
          records: {
            ...s.records,
            // year/month/id/createdAt are locked here so the record stays in its bucket. A month
            // CHANGE goes through moveTransaction instead (re-bucketing is safe; see mergeRecords).
            [key]: rows.map((r) =>
              r.id === id ? { ...r, ...patch, updatedAt: nowIso() } : r,
            ),
          },
        };
      });
      persist();
    },

    moveTransaction: (fromYear, fromMonth, id, toYear, toMonth, patch) => {
      const fromKey = monthKey(fromYear, fromMonth);
      const toKey = monthKey(toYear, toMonth);
      const ts = nowIso();
      set((s) => {
        const fromRows = s.records[fromKey];
        const tx = fromRows?.find((r) => r.id === id);
        if (!fromRows || !tx) return s;
        // Same id/createdAt, new bucket + edited fields. The merge flattens by id globally and
        // re-buckets by each row's year/month, so a newer updatedAt supersedes the old-bucket copy on
        // another device — no duplicate, and no tombstone needed (the id is re-homed, not deleted).
        const moved: Transaction = { ...tx, ...patch, year: toYear, month: toMonth, updatedAt: ts };
        const hasYear = s.years.includes(toYear);
        return {
          records: {
            ...s.records,
            [fromKey]: fromRows.filter((r) => r.id !== id),
            [toKey]: [...(s.records[toKey] ?? []), moved],
          },
          years: hasYear ? s.years : [...s.years, toYear].sort((a, b) => b - a),
          yearMeta: hasYear
            ? s.yearMeta
            : { ...s.yearMeta, [toYear]: { updatedAt: ts, deleted: false } },
        };
      });
      persist();
    },

    deleteTransaction: (year, month, id) => {
      const key = monthKey(year, month);
      set((s) => {
        const rows = s.records[key];
        if (!rows) return s;
        return {
          records: {
            ...s.records,
            [key]: rows.map((r) =>
              r.id === id ? { ...r, deleted: true, updatedAt: nowIso() } : r,
            ),
          },
        };
      });
      persist();
    },

    deleteInstallment: (installmentId) => {
      const ts = nowIso();
      set((s) => {
        const records = { ...s.records };
        for (const key of Object.keys(records)) {
          let touched = false;
          const next = records[key].map((r) => {
            if (r.installmentId === installmentId && !r.deleted) {
              touched = true;
              // Soft-delete (tombstone) so the deletion survives the Drive merge, like every other delete.
              return { ...r, deleted: true, updatedAt: ts };
            }
            return r;
          });
          if (touched) records[key] = next;
        }
        return { records };
      });
      persist();
    },

    updateInstallment: (installmentId, input) => {
      const ts = nowIso();
      set((s) => {
        // Anchor on the current FIRST slice so a re-split keeps the original purchase month, no matter
        // which slice was opened for editing.
        let first: Transaction | null = null;
        for (const rows of Object.values(s.records)) {
          for (const r of rows) {
            if (r.installmentId !== installmentId || r.deleted) continue;
            if (!first || (r.installmentSeq ?? 99) < (first.installmentSeq ?? 99)) first = r;
          }
        }
        if (!first) return s;

        const slices = planInstallmentSlices(
          first.year,
          first.month,
          input.total,
          input.count,
          input.day,
        );
        const count = slices.length;
        const bySeq = new Map(slices.map((sl) => [sl.seq, sl]));
        const records = { ...s.records };

        // Update existing slices in place (match by seq → keeps ids stable); tombstone any dropped seq.
        for (const key of Object.keys(records)) {
          let touched = false;
          const next = records[key].map((r) => {
            if (r.installmentId !== installmentId || r.deleted) return r;
            touched = true;
            const sl = bySeq.get(r.installmentSeq ?? -1);
            if (!sl) return { ...r, deleted: true, updatedAt: ts }; // count shrank → drop this month
            bySeq.delete(r.installmentSeq ?? -1);
            return {
              ...r,
              amount: sl.amount,
              day: sl.day,
              type: input.type || '지출',
              category: input.category ?? '',
              merchant: input.merchant ?? '',
              note: input.note ?? '',
              installmentCount: count,
              updatedAt: ts,
            };
          });
          if (touched) records[key] = next;
        }

        // Seqs still unmatched = months added (count grew) → create fresh slices, same installmentId.
        const years = new Set(s.years);
        const yearMeta = { ...s.yearMeta };
        for (const sl of bySeq.values()) {
          const key = monthKey(sl.year, sl.month);
          const tx: Transaction = {
            id: newId(),
            createdAt: ts,
            updatedAt: ts,
            deleted: false,
            year: sl.year,
            month: sl.month,
            day: sl.day,
            type: input.type || '지출',
            category: input.category ?? '',
            merchant: input.merchant ?? '',
            amount: sl.amount,
            note: input.note ?? '',
            installmentId,
            installmentSeq: sl.seq,
            installmentCount: count,
          };
          records[key] = [...(records[key] ?? []), tx];
          if (!years.has(sl.year)) {
            years.add(sl.year);
            yearMeta[sl.year] = { updatedAt: ts, deleted: false };
          }
        }
        return { records, years: [...years].sort((a, b) => b - a), yearMeta };
      });
      persist();
    },

    deleteMonth: (year, month) => {
      const key = monthKey(year, month);
      set((s) => {
        const rows = s.records[key];
        if (!rows) return s;
        const ts = nowIso();
        // Soft-delete (tombstone) every row so the deletion survives the Drive merge.
        return {
          records: {
            ...s.records,
            [key]: rows.map((r) => (r.deleted ? r : { ...r, deleted: true, updatedAt: ts })),
          },
        };
      });
      persist();
    },

    updateMonthlyBudget: (year, month, budget) => {
      set((s) => {
        const key = monthKey(year, month);
        const monthlyBudgets = { ...s.settings.monthlyBudgets };
        if (budget === null) delete monthlyBudgets[key];
        else monthlyBudgets[key] = budget;
        // Budget only. Fixed expenses are set up separately (apply-defaults or the per-month editor) —
        // never auto-frozen from the template here, so a custom budget doesn't pull the template in.
        // Setting a budget re-configures the month → lift any prior "reset" tombstone.
        const clearedMonths =
          budget === null
            ? s.settings.clearedMonths
            : (s.settings.clearedMonths ?? []).filter((k) => k !== key);
        return {
          settings: { ...s.settings, monthlyBudgets, clearedMonths, updatedAt: nowIso() },
        };
      });
      persist();
    },

    applyDefaultsToMonth: (year, month) => {
      set((s) => {
        const key = monthKey(year, month);
        const ts = nowIso();
        return {
          settings: {
            ...s.settings,
            monthlyBudgets: { ...s.settings.monthlyBudgets, [key]: s.settings.budget },
            // Freeze a COPY of the current default fixed expenses into this month (independent thereafter).
            monthlyFixedExpenses: {
              ...s.settings.monthlyFixedExpenses,
              [key]: s.settings.fixedExpenses.filter((e) => !e.deleted).map((e) => ({ ...e })),
            },
            // Setting it up clears any prior reset tombstone for this month.
            clearedMonths: (s.settings.clearedMonths ?? []).filter((k) => k !== key),
            updatedAt: ts,
          },
        };
      });
      persist();
    },

    resetMonthSetup: (year, month) => {
      set((s) => {
        const key = monthKey(year, month);
        const monthlyBudgets = { ...s.settings.monthlyBudgets };
        delete monthlyBudgets[key];
        const monthlyFixedExpenses = { ...s.settings.monthlyFixedExpenses };
        delete monthlyFixedExpenses[key];
        const cleared = s.settings.clearedMonths ?? [];
        return {
          settings: {
            ...s.settings,
            monthlyBudgets,
            monthlyFixedExpenses,
            // Tombstone so the clear survives the Drive merge (delete wins over the union resurrect).
            clearedMonths: cleared.includes(key) ? cleared : [...cleared, key],
            updatedAt: nowIso(),
          },
        };
      });
      persist();
    },

    updateSettings: (patch) => {
      set((s) => {
        const ts = nowIso();
        return {
          settings: {
            ...s.settings,
            ...patch,
            updatedAt: ts,
            // Stamp the budget's own edit time so it merges by recency across devices — a bare scalar
            // otherwise stays "local wins" in the Drive merge and never syncs in from another device.
            budgetUpdatedAt: patch.budget !== undefined ? ts : s.settings.budgetUpdatedAt,
          },
        };
      });
      persist();
    },

    addFixedExpense: (input) => {
      const ts = nowIso();
      const expense: FixedExpense = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deleted: false,
        title: input.title,
        type: input.type,
        amount: input.amount,
        date: input.date,
        note: input.note ?? '',
      };
      set((s) => ({
        settings: {
          ...s.settings,
          fixedExpenses: [...s.settings.fixedExpenses, expense],
          updatedAt: ts,
        },
      }));
      persist();
      return expense;
    },

    updateFixedExpense: (id, patch) => {
      const ts = nowIso();
      set((s) => ({
        settings: {
          ...s.settings,
          fixedExpenses: s.settings.fixedExpenses.map((e) =>
            e.id === id ? { ...e, ...patch, note: patch.note ?? e.note, updatedAt: ts } : e,
          ),
          updatedAt: ts,
        },
      }));
      persist();
    },

    deleteFixedExpense: (id) => {
      const ts = nowIso();
      set((s) => ({
        settings: {
          ...s.settings,
          // Soft-delete (tombstone) rather than drop, so the deletion survives the Drive merge.
          fixedExpenses: s.settings.fixedExpenses.map((e) =>
            e.id === id ? { ...e, deleted: true, updatedAt: ts } : e,
          ),
          updatedAt: ts,
        },
      }));
      persist();
    },

    // --- Per-month fixed expenses: edit the frozen snapshot for one month. monthSnapshotBase seeds
    // from the template on first touch, so an edit here lands on that month only, never the template. ---
    addMonthFixedExpense: (year, month, input) => {
      const ts = nowIso();
      const expense: FixedExpense = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deleted: false,
        title: input.title,
        type: input.type,
        amount: input.amount,
        date: input.date,
        note: input.note ?? '',
      };
      set((s) => {
        const key = monthKey(year, month);
        const base = monthSnapshotBase(s.settings, key);
        return {
          settings: {
            ...s.settings,
            monthlyFixedExpenses: { ...s.settings.monthlyFixedExpenses, [key]: [...base, expense] },
            updatedAt: ts,
          },
        };
      });
      persist();
      return expense;
    },

    updateMonthFixedExpense: (year, month, id, patch) => {
      const ts = nowIso();
      set((s) => {
        const key = monthKey(year, month);
        const base = monthSnapshotBase(s.settings, key);
        return {
          settings: {
            ...s.settings,
            monthlyFixedExpenses: {
              ...s.settings.monthlyFixedExpenses,
              [key]: base.map((e) =>
                e.id === id ? { ...e, ...patch, note: patch.note ?? e.note, updatedAt: ts } : e,
              ),
            },
            updatedAt: ts,
          },
        };
      });
      persist();
    },

    deleteMonthFixedExpense: (year, month, id) => {
      const ts = nowIso();
      set((s) => {
        const key = monthKey(year, month);
        const base = monthSnapshotBase(s.settings, key);
        return {
          settings: {
            ...s.settings,
            // Soft-delete (tombstone) so the deletion survives the per-item Drive merge for this month.
            monthlyFixedExpenses: {
              ...s.settings.monthlyFixedExpenses,
              [key]: base.map((e) => (e.id === id ? { ...e, deleted: true, updatedAt: ts } : e)),
            },
            updatedAt: ts,
          },
        };
      });
      persist();
    },

    addCategory: (input) => {
      const ts = nowIso();
      const category: CategoryItem = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deleted: false,
        name: input.name,
        icon: input.icon,
        type: input.type,
        subcategories: input.subcategories,
      };
      set((s) => ({ categories: [...s.categories, category] }));
      persist();
      return category;
    },

    updateCategory: (id, patch) => {
      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c,
        ),
      }));
      persist();
    },

    deleteCategory: (id) => {
      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === id ? { ...c, deleted: true, updatedAt: nowIso() } : c,
        ),
      }));
      persist();
    },

    reorderCategories: (type, orderedIds) => {
      const ts = nowIso();
      const rank = new Map(orderedIds.map((id, i) => [id, i]));
      set((s) => ({
        categories: s.categories.map((c) => {
          const idx = c.type === type ? rank.get(c.id) : undefined;
          return idx === undefined ? c : { ...c, order: idx, updatedAt: ts };
        }),
      }));
      persist();
    },
  };
});
