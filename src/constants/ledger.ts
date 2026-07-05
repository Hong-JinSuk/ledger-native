import type { Settings } from '@/types/ledger';

/** AsyncStorage key holding the whole ledger snapshot (single doc → maps to the future Drive file). */
export const LEDGER_STORAGE_KEY = 'ledger:snapshot:v1';

export const LEDGER_SNAPSHOT_VERSION = 1;

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
  monthlyBudgets: {},
  currency: DEFAULT_CURRENCY,
  fixedExpenseTypes: [...DEFAULT_FIXED_EXPENSE_TYPES],
  fixedExpenses: [],
  lastBudgetConfirmation: undefined,
  updatedAt: SEED_TIMESTAMP,
};
