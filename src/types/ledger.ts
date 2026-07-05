/**
 * Core ledger domain types.
 *
 * Every SYNCED entity (Transaction, CategoryItem) carries {@link SyncMeta} so the
 * Drive merge (Phase 6) can pair items by `id`, resolve conflicts by `updatedAt`,
 * and recognise deletions via the `deleted` tombstone (never hard-delete synced items).
 */

/** 수입 = income · 지출 = expense · 이체 = transfer. */
export type TransactionType = '수입' | '지출' | '이체';

/** Common sync metadata carried by every synced entity. */
export interface SyncMeta {
  /** Device-generated UUID — the primary key, stable across devices/sync. Never server-issued. */
  id: string;
  /** ISO-8601 creation time. */
  createdAt: string;
  /** ISO-8601 last-edit time — bumped on every mutation; the key for merge conflict resolution. */
  updatedAt: string;
  /** Soft-delete tombstone. Deletions set this true (+ bump updatedAt) instead of removing the row. */
  deleted: boolean;
}

/** A single income/expense/transfer entry. Ported from the web `LedgerRow` + sync meta. */
export interface Transaction extends SyncMeta {
  year: number;
  /** 1–12. */
  month: number;
  /** 1–31, or null when the day is unspecified. */
  day: number | null;
  /** '' only while a freshly-added row is still blank (not yet given a type). */
  type: TransactionType | '';
  /** Category name (matches a {@link CategoryItem.name}). */
  category?: string;
  merchant?: string;
  /** Integer amount in KRW (no decimals, no floats — money is never a float). */
  amount: number;
  note: string;
}

/** A user-facing category. Defaults ship with stable ids (see constants/categories). */
export interface CategoryItem extends SyncMeta {
  name: string;
  /** lucide icon name (e.g. 'Utensils'). */
  icon: string;
  type: TransactionType;
  subcategories: string[];
}

/** A recurring fixed cost. Local to Settings (not an independently-synced entity). */
export interface FixedExpense {
  id: string;
  type: string;
  title: string;
  amount: number;
  /** Day of month 1–31, or null. */
  date: number | null;
  note: string;
}

/** App/user settings + budget. Persisted & synced as a single document. */
export interface Settings {
  /** Default monthly budget, offered when confirming a new month. */
  budget: number;
  /** Per-month budget overrides. Key: 'YYYY-MM'. */
  monthlyBudgets: Record<string, number>;
  /** Currency suffix, e.g. '원'. */
  currency: string;
  fixedExpenseTypes: string[];
  fixedExpenses: FixedExpense[];
  /** 'YYYY-MM' of the month whose budget prompt the user last confirmed (drives the "first entry" prompt). */
  lastBudgetConfirmation?: string;
  /** ISO-8601 — for future settings-level merge. */
  updatedAt: string;
}

/**
 * The full persisted/synced ledger document. Maps 1:1 to the AsyncStorage snapshot
 * today and to the Google Drive JSON file later.
 */
export interface LedgerSnapshot {
  version: number;
  years: number[];
  /** Transactions bucketed by month. Key: 'YYYY-MM'. */
  records: Record<string, Transaction[]>;
  categories: CategoryItem[];
  settings: Settings;
}
