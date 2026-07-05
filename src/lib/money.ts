import type { TransactionType } from '@/types/ledger';

/**
 * Format an integer amount with thousands separators.
 *
 * Uses manual grouping (not `toLocaleString`/`Intl.NumberFormat`) so output is identical
 * across JS engines — Hermes' Intl grouping has been inconsistent on Android. Money is
 * integer KRW, so this simple grouping is exact and float-free.
 */
export function formatAmount(amount: number): string {
  const n = Math.trunc(amount || 0);
  const grouped = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `-${grouped}` : grouped;
}

/** e.g. `1234567 → '1,234,567원'`. */
export function formatCurrency(amount: number, currency = '원'): string {
  return `${formatAmount(amount)}${currency}`;
}

/**
 * Signed display by transaction type: 지출 shows a leading '-', 수입/이체 show none.
 * Amounts are stored as positive magnitudes; the sign is presentational, derived from type.
 */
export function formatSignedCurrency(
  amount: number,
  type: TransactionType | '',
  currency = '원',
): string {
  const magnitude = Math.abs(Math.trunc(amount || 0));
  const sign = type === '지출' ? '-' : '';
  return `${sign}${formatCurrency(magnitude, currency)}`;
}

/** Parse user input (may contain commas / currency / other non-digits) into an integer amount. */
export function parseAmount(input: string): number {
  const digits = input.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
