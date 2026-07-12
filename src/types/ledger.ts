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

/**
 * A recurring fixed cost. Stored inside the Settings document but merged as its OWN id-keyed
 * synced collection (like Transaction/CategoryItem) — so an expense added on one device isn't
 * clobbered by the other device's whole-settings overwrite. Carries {@link SyncMeta} for that:
 * pair by `id`, local wins conflicts, and deletions tombstone (never hard-delete) so they survive.
 */
export interface FixedExpense extends SyncMeta {
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
  /** ISO-8601 of the last {@link budget} change — lets this scalar merge by recency, not just local-wins. */
  budgetUpdatedAt?: string;
  /** Per-month budget overrides. Key: 'YYYY-MM'. */
  monthlyBudgets: Record<string, number>;
  /** Currency suffix, e.g. '원'. */
  currency: string;
  fixedExpenseTypes: string[];
  /**
   * The LIVE template of recurring fixed costs (edited in Settings). Applied to a month only until
   * that month is frozen — see {@link monthlyFixedExpenses}. Editing it never rewrites a frozen month.
   */
  fixedExpenses: FixedExpense[];
  /**
   * Per-month FROZEN snapshot of the fixed expenses (full list) as they stood when the month's budget
   * was first set. Key: 'YYYY-MM'. A month's budget calc reads its snapshot here if present, else the
   * live {@link fixedExpenses} template — so past months keep their own fixed costs and never drift when
   * the template changes. Merged whole-key (union, local wins) like {@link monthlyBudgets}; optional
   * because snapshots written before this feature omit it.
   */
  monthlyFixedExpenses?: Record<string, FixedExpense[]>;
  /** 'YYYY-MM' of the month whose budget prompt the user last confirmed (drives the "first entry" prompt). */
  lastBudgetConfirmation?: string;
  /** ISO-8601 — for future settings-level merge. */
  updatedAt: string;
}

/**
 * Per-year sync state. `years` is a plain number[] with no id/tombstone, so a year deletion couldn't
 * survive the Drive merge — it just got unioned back. This gives each year add/delete a timestamp so
 * deletions propagate and a later re-add wins by recency.
 */
export interface YearMeta {
  /** ISO-8601 of this year's last add/delete. */
  updatedAt: string;
  /** True if the year was deleted (its transactions are separately tombstoned). */
  deleted: boolean;
}

/**
 * The full persisted/synced ledger document. Maps 1:1 to the AsyncStorage snapshot
 * today and to the Google Drive JSON file later.
 */
export interface LedgerSnapshot {
  version: number;
  years: number[];
  /** Per-year add/delete state, keyed by year string. Optional — snapshots written before this omit it. */
  yearMeta?: Record<string, YearMeta>;
  /** Transactions bucketed by month. Key: 'YYYY-MM'. */
  records: Record<string, Transaction[]>;
  categories: CategoryItem[];
  settings: Settings;
}
