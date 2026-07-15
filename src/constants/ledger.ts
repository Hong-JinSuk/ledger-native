import type { Settings } from '@/types/ledger';

/** AsyncStorage key holding the whole ledger snapshot (single doc → maps to the future Drive file). */
export const LEDGER_STORAGE_KEY = 'ledger:snapshot:v1';

/**
 * AsyncStorage key recording which Google account (Supabase user id) the local snapshot belongs to.
 * The snapshot store isn't keyed by account, so a second account signing in on the same device/browser
 * would otherwise merge (and push) the first account's data. Kept OUT of the synced snapshot — a purely
 * local guard (see sync-service `ensureAccountScope`).
 */
export const LEDGER_OWNER_KEY = 'ledger:owner:v1';

/** Whether the first-run welcome setup (default budget + fixed expenses) has been shown on THIS device.
 *  Local-only UI flag — deliberately not synced (it's per-device chrome, not ledger data). */
export const ONBOARDING_SEEN_KEY = 'ledger:onboarding-seen:v1';

// v2: 지출 category consolidation (카페/간식 → 식비, 온라인/패션쇼핑 → 쇼핑).
// v3: drop the redundant 카페/간식 subcategory an interim v2 folded into 식비.
// v4: 자동차→교통, 내계좌이체→이체, 상여금→급여 (each as a subcategory). See lib/ledger/migrate.
export const LEDGER_SNAPSHOT_VERSION = 4;

/**
 * Fixed timestamp stamped on all SEEDED default data (categories, initial settings).
 * Being identical across installs makes seeds merge-safe: the same default category has the
 * same id + unchanged updatedAt on every device, so merge treats them as one, not duplicates.
 */
export const SEED_TIMESTAMP = '2024-01-01T00:00:00.000Z';

export const DEFAULT_CURRENCY = '원';

export const DEFAULT_FIXED_EXPENSE_TYPES = ['통신비', '교통비', '주거비', '보험료', '구독료'];

export const DEFAULT_SETTINGS: Settings = {
  budget: 0,
  budgetUpdatedAt: SEED_TIMESTAMP,
  monthlyBudgets: {},
  currency: DEFAULT_CURRENCY,
  fixedExpenseTypes: [...DEFAULT_FIXED_EXPENSE_TYPES],
  fixedExpenses: [],
  monthlyFixedExpenses: {},
  clearedMonths: [],
  updatedAt: SEED_TIMESTAMP,
};
