import { create } from 'zustand';

import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { DEFAULT_SETTINGS, LEDGER_SNAPSHOT_VERSION } from '@/constants/ledger';
import { monthKey } from '@/lib/date';
import { newId, nowIso } from '@/lib/id';
import { asyncStorageLedger, type LedgerStorage } from '@/lib/storage/ledger-storage';
import type {
  CategoryItem,
  LedgerSnapshot,
  Settings,
  Transaction,
  TransactionType,
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

export interface LedgerState {
  /** True once the on-device snapshot has been loaded (or seeded on first launch). */
  hydrated: boolean;
  years: number[];
  records: Record<string, Transaction[]>;
  categories: CategoryItem[];
  settings: Settings;

  hydrate: () => Promise<void>;

  addYear: (year: number) => void;
  deleteYear: (year: number) => void;
  ensureMonthInitialized: (year: number, month: number) => void;

  addTransaction: (input: NewTransactionInput) => Transaction;
  updateTransaction: (year: number, month: number, id: string, patch: TransactionPatch) => void;
  deleteTransaction: (year: number, month: number, id: string) => void;

  updateMonthlyBudget: (year: number, month: number, budget: number | null) => void;
  confirmBudget: (yearMonth: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  addCategory: (input: CategoryInput) => CategoryItem;
  updateCategory: (id: string, patch: Partial<CategoryInput>) => void;
  deleteCategory: (id: string) => void;
}

export const useLedgerStore = create<LedgerState>((set, get) => {
  /** Snapshot the persistable slice and write it through to storage. */
  const persist = () => {
    const { years, records, categories, settings } = get();
    persistSnapshot({ version: LEDGER_SNAPSHOT_VERSION, years, records, categories, settings });
  };

  return {
    hydrated: false,
    years: [new Date().getFullYear()],
    records: {},
    categories: DEFAULT_CATEGORIES,
    settings: DEFAULT_SETTINGS,

    hydrate: async () => {
      const snapshot = await storage.load();
      if (snapshot) {
        set({
          years: snapshot.years?.length ? snapshot.years : [new Date().getFullYear()],
          records: snapshot.records ?? {},
          categories: snapshot.categories?.length ? snapshot.categories : DEFAULT_CATEGORIES,
          settings: { ...DEFAULT_SETTINGS, ...snapshot.settings },
          hydrated: true,
        });
      } else {
        // First launch: mark hydrated and seed defaults into storage.
        set({ hydrated: true });
        persist();
      }
    },

    addYear: (year) => {
      set((s) =>
        s.years.includes(year) ? s : { years: [...s.years, year].sort((a, b) => b - a) },
      );
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
        return { years: s.years.filter((y) => y !== year), records };
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

    updateMonthlyBudget: (year, month, budget) => {
      set((s) => {
        const key = monthKey(year, month);
        const monthlyBudgets = { ...s.settings.monthlyBudgets };
        if (budget === null) delete monthlyBudgets[key];
        else monthlyBudgets[key] = budget;
        return { settings: { ...s.settings, monthlyBudgets, updatedAt: nowIso() } };
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
      set((s) => ({ settings: { ...s.settings, ...patch, updatedAt: nowIso() } }));
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
