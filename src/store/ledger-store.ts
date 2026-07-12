import { create } from 'zustand';

import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { DEFAULT_SETTINGS, LEDGER_SNAPSHOT_VERSION } from '@/constants/ledger';
import { monthKey } from '@/lib/date';
import { newId, nowIso } from '@/lib/id';
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
  return (
    settings.monthlyFixedExpenses?.[key] ??
    settings.fixedExpenses.filter((e) => !e.deleted).map((e) => ({ ...e }))
  );
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

  addYear: (year: number) => void;
  deleteYear: (year: number) => void;
  ensureMonthInitialized: (year: number, month: number) => void;

  addTransaction: (input: NewTransactionInput) => Transaction;
  updateTransaction: (year: number, month: number, id: string, patch: TransactionPatch) => void;
  deleteTransaction: (year: number, month: number, id: string) => void;
  /** Soft-delete every record in a month (parallels deleteYear, one bucket). */
  deleteMonth: (year: number, month: number) => void;

  updateMonthlyBudget: (year: number, month: number, budget: number | null) => void;
  confirmBudget: (yearMonth: string) => void;
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
      const snapshot = await storage.load();
      if (snapshot) {
        const loaded: Settings = {
          ...DEFAULT_SETTINGS,
          ...snapshot.settings,
          // Backfill sync meta on fixed expenses saved before FixedExpense carried it, so every
          // in-memory expense has id/updatedAt/deleted for the merge.
          fixedExpenses: (snapshot.settings?.fixedExpenses ?? []).map(normalizeFixedExpense),
        };
        // Migration: months that already have a budget but no frozen snapshot predate per-month freezing.
        // Freeze them at the current template so their fixed-expense figures stop drifting when the
        // template later changes. We have no historical template, so today's is the best we can do; only
        // budgeted months are captured (matching the freeze-on-budget rule).
        const monthlyFixedExpenses = { ...(loaded.monthlyFixedExpenses ?? {}) };
        for (const key of Object.keys(loaded.monthlyBudgets ?? {})) {
          if (!monthlyFixedExpenses[key]) {
            monthlyFixedExpenses[key] = loaded.fixedExpenses
              .filter((e) => !e.deleted)
              .map((e) => ({ ...e }));
          }
        }
        set({
          years: snapshot.years?.length ? snapshot.years : [new Date().getFullYear()],
          yearMeta: snapshot.yearMeta ?? {},
          records: snapshot.records ?? {},
          categories: snapshot.categories?.length ? snapshot.categories : DEFAULT_CATEGORIES,
          settings: { ...loaded, monthlyFixedExpenses },
          hydrated: true,
        });
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
        // Re-merge here (not a blind overwrite): if the user edited during the async pull, those
        // current values win, so an in-flight sync can never clobber fresh local work.
        const merged = mergeLedger(current, incoming);
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
      set((s) => ({ records: { ...s.records, [key]: [...(s.records[key] ?? []), tx] } }));
      persist();
      return tx;
    },

    updateTransaction: (year, month, id, patch) => {
      const key = monthKey(year, month);
      set((s) => {
        const rows = s.records[key];
        if (!rows) return s;
        return {
          records: {
            ...s.records,
            // year/month/id/createdAt are locked so the record stays in its bucket (merge invariant).
            [key]: rows.map((r) =>
              r.id === id ? { ...r, ...patch, updatedAt: nowIso() } : r,
            ),
          },
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
        // Freeze this month's fixed expenses the first time it gets a budget. Once frozen it's never
        // re-captured — so editing the Settings template (or re-saving this budget) can't rewrite a past
        // month. Template edits only reach months not yet frozen (i.e. future months).
        const monthlyFixedExpenses = { ...s.settings.monthlyFixedExpenses };
        if (budget !== null && budget > 0 && !monthlyFixedExpenses[key]) {
          monthlyFixedExpenses[key] = s.settings.fixedExpenses
            .filter((e) => !e.deleted)
            .map((e) => ({ ...e }));
        }
        return {
          settings: { ...s.settings, monthlyBudgets, monthlyFixedExpenses, updatedAt: nowIso() },
        };
      });
      persist();
    },

    confirmBudget: (yearMonth) => {
      set((s) => ({
        settings: { ...s.settings, lastBudgetConfirmation: yearMonth, updatedAt: nowIso() },
      }));
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
  };
});
