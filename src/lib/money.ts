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

/**
 * Compact amount in Korean 만/억 units for tight spaces (chart centres, bar captions) where the full
 * grouped figure won't fit. Full precision stays in {@link formatAmount}/{@link formatCurrency} — this
 * is a glanceable summary, so it rounds:
 *   `8,500 → '8,500'` · `15,000 → '1.5만'` · `1,234,567 → '123만'` · `234,567,890 → '2.3억'`
 * Under 1만 it falls through to plain grouping (no unit). Sign is preserved.
 */
export function formatCompactAmount(amount: number): string {
  const n = Math.trunc(Math.abs(amount || 0));
  const sign = amount < 0 ? '-' : '';
  if (n < 10_000) return sign + formatAmount(n);
  if (n < 100_000_000) return `${sign}${compactUnit(n / 10_000)}만`;
  return `${sign}${compactUnit(n / 100_000_000)}억`;
}

/** One significant decimal below 100, whole numbers at/above it — keeps a unit figure ~2–4 chars. */
function compactUnit(value: number): string {
  return value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

/** Parse user input (may contain commas / currency / other non-digits) into an integer amount. */
export function parseAmount(input: string): number {
  const digits = input.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
